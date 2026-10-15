// Apple Vision's reading of one photograph — the number and what it saw.
//
// ── what this is for (owner, 15 Oct 2026) ──
//
// A gallery holds a place's Google photos beside the ones its guide
// uploaded, and choosing the cover meant looking at each. The phone has
// an aesthetics model of its own since iOS 18, on the device and free,
// so the guide can ask it once per photograph and keep the answer
// (`photo_scores`). The same reading will serve the in-app camera when
// it exists, which is why this is a module and not a screen's helper.
//
// ── what it returns, and what it does not decide ──
//
// Raw measurements only: Vision's `overallScore` (−1…1), its `isUtility`
// flag, and a handful of signals measured on the same pixels. No 0–10,
// no "Very good", no sentence. Those are `src/lib/photoScore.ts`, in
// JavaScript, for one reason: the thresholds that turn "mean luma 0.21"
// into "a little dark" are guesses until a few hundred real photographs
// have been read, and a guess in JavaScript is corrected by an EAS
// Update, where a guess in here needs a new binary and a TestFlight
// round. What is stored is what was measured, so a better wording never
// asks for a photograph to be read again.
//
// ── why two Vision APIs ──
//
// The aesthetics request exists only in the Swift-native API iOS 18
// introduced (`CalculateImageAestheticsScoresRequest`). Everything else
// is the older `VN…` family, run as one batch through one
// `VNImageRequestHandler`: one decode serves five requests, and those
// requests have a decade of behaviour behind them. Rewriting them in the
// new API would buy nothing the readings use.
//
// ── what was left out ──
//
// Near-duplicates (`VNGenerateImageFeaturePrintRequest`). A duplicate is
// a fact about a pair, not a photograph: answering it means keeping a
// 768-float print per photo and comparing every new one against the
// rest, which is a different table and a different screen. Face quality
// (`VNDetectFaceCaptureQualityRequest`) too: a cover with a face in it
// already loses on the desk's own rule, so how good the face is does not
// change an answer.

import CoreGraphics
import ExpoModulesCore
import Foundation
import ImageIO
import Vision

public class PhotoScoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoScore")

    // Synchronous, so the screen can decide whether to draw the button
    // in the render that draws the grid, rather than one frame after.
    Function("isAvailable") { () -> Bool in
      if #available(iOS 18.0, *) { return true }
      return false
    }

    AsyncFunction("scoreAsync") { (uri: String) async throws -> [String: Any] in
      guard #available(iOS 18.0, *) else { throw VisionUnavailableException() }
      guard let url = URL(string: uri) else { throw UnreadableImageException(uri) }
      let data: Data
      if url.isFileURL {
        data = try Data(contentsOf: url)
      } else {
        let (body, _) = try await URLSession.shared.data(from: url)
        data = body
      }
      return try await Reading.of(data, uri: uri)
    }
  }
}

internal final class VisionUnavailableException: Exception {
  override var reason: String { "Scoring photos needs iOS 18 or later" }
}

internal final class UnreadableImageException: GenericException<String> {
  override var reason: String { "No image could be read at \(param)" }
}

@available(iOS 18.0, *)
enum Reading {
  /// The longest side Vision is shown. The aesthetics model scales its
  /// input down to a few hundred points whatever it is handed, so a
  /// 4032-pixel original costs decode time and memory and changes no
  /// score; 1024 keeps text and people detection honest on a wide shot.
  static let visionSide: CGFloat = 1024

  /// The longest side the light and the focus are measured on. Smaller
  /// than Vision's: they are statistics over pixels, and 512 is a quarter
  /// of the work of 1024 for the same mean.
  static let lumaSide = 512

  static func of(_ data: Data, uri: String) async throws -> [String: Any] {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            // EXIF orientation applied, so "up" is the photographer's up
            // and the horizon and the subject are measured the right way.
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: visionSide,
          ] as CFDictionary)
    else { throw UnreadableImageException(uri) }

    let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
    let width = props?[kCGImagePropertyPixelWidth] as? Int ?? image.width
    let height = props?[kCGImagePropertyPixelHeight] as? Int ?? image.height

    let aesthetics = try await CalculateImageAestheticsScoresRequest().perform(on: image)

    let classify = VNClassifyImageRequest()
    let humans = VNDetectHumanRectanglesRequest()
    humans.upperBodyOnly = false
    let text = VNRecognizeTextRequest()
    // Fast: the question is "is there writing across this photo", not
    // what it says, and the accurate pass is several times slower.
    text.recognitionLevel = .fast
    text.usesLanguageCorrection = false
    let saliency = VNGenerateAttentionBasedSaliencyImageRequest()
    let horizon = VNDetectHorizonRequest()
    try VNImageRequestHandler(cgImage: image, options: [:])
      .perform([classify, humans, text, saliency, horizon])

    var signals: [String: Any] = ["width": width, "height": height]

    let light = luma(image)
    signals["brightness"] = light.mean
    signals["shadows"] = light.shadows
    signals["highlights"] = light.highlights
    signals["sharpness"] = light.sharpness

    // Vision's rectangles are normalised with the origin bottom-left;
    // stored top-left, the way every screen reads a photograph.
    let objects = saliency.results?.first?.salientObjects ?? []
    if let first = objects.first {
      let box = objects.dropFirst().reduce(first.boundingBox) { $0.union($1.boundingBox) }
      signals["subject"] = [
        "x": Double(box.midX), "y": Double(1 - box.midY), "area": Double(box.width * box.height),
      ]
    }

    // Expo hands Double, Int, Bool and String across; CGFloat is turned
    // into Double here rather than trusted to the bridge.
    if let angle = horizon.results?.first?.angle {
      signals["tilt"] = Double(angle) * 180 / .pi
    }

    // Half confidence and over: the detector's low end finds people in
    // coat stands and chair backs.
    let people = (humans.results ?? []).filter { $0.confidence >= 0.5 }
    signals["people"] = people.count
    signals["peopleArea"] = people.map { Double($0.boundingBox.width * $0.boundingBox.height) }.max() ?? 0

    let lines = (text.results ?? []).filter { $0.confidence >= 0.5 }
    signals["textLines"] = lines.count
    signals["textArea"] = lines.reduce(0.0) { $0 + Double($1.boundingBox.width * $1.boundingBox.height) }

    // The five most confident of Vision's ~1,300 labels, from a tenth up.
    // Kept for the explanation (greenery, food) and for the reading
    // after: which labels go with high scores is a question the stored
    // rows can answer later.
    signals["labels"] = (classify.results ?? [])
      .filter { $0.confidence >= 0.1 }
      .sorted { $0.confidence > $1.confidence }
      .prefix(5)
      .map { ["id": $0.identifier, "p": Double($0.confidence)] as [String: Any] }

    return [
      "aesthetic": Double(aesthetics.overallScore),
      "isUtility": aesthetics.isUtility,
      "signals": signals,
    ]
  }

  /// Light and focus, on a grey copy: the mean, the share of pixels
  /// crushed to black (under 5%) or blown to white (over 95%), and the
  /// variance of the Laplacian — the usual measure of focus, high where
  /// edges are crisp, low where everything is soft.
  static func luma(_ image: CGImage) -> (mean: Double, shadows: Double, highlights: Double, sharpness: Double) {
    let scale = min(1, CGFloat(lumaSide) / CGFloat(max(image.width, image.height)))
    let w = max(3, Int(CGFloat(image.width) * scale))
    let h = max(3, Int(CGFloat(image.height) * scale))
    var px = [UInt8](repeating: 0, count: w * h)
    let drawn: Bool = px.withUnsafeMutableBytes { buf in
      guard let ctx = CGContext(
        data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
      ) else { return false }
      ctx.interpolationQuality = .medium
      ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
      return true
    }
    guard drawn else { return (0, 0, 0, 0) }

    var sum = 0, dark = 0, bright = 0
    for v in px {
      sum += Int(v)
      if v < 13 { dark += 1 } else if v > 242 { bright += 1 }
    }
    let n = Double(w * h)

    var lapSum = 0.0, lapSq = 0.0
    for y in 1..<(h - 1) {
      for x in 1..<(w - 1) {
        let i = y * w + x
        let l = Double(Int(px[i - w]) + Int(px[i + w]) + Int(px[i - 1]) + Int(px[i + 1]) - 4 * Int(px[i]))
        lapSum += l
        lapSq += l * l
      }
    }
    let m = Double((w - 2) * (h - 2))
    let lapMean = lapSum / m

    return (
      mean: Double(sum) / n / 255,
      shadows: Double(dark) / n,
      highlights: Double(bright) / n,
      sharpness: lapSq / m - lapMean * lapMean
    )
  }
}
