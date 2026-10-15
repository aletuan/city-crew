# The app's own native module: Apple Vision's reading of one photograph.
# Local to the app (`app/modules/`, which Expo autolinking scans), not a
# package — nothing outside City Crew calls it. iOS 16.4 because that is
# the floor ExpoModulesCore itself declares; the module answers
# `isAvailable() == false` below iOS 18, where the aesthetics request
# does not exist, and the app hides the button.
Pod::Spec.new do |s|
  s.name           = 'PhotoScore'
  s.version        = '1.0.0'
  s.summary        = 'Apple Vision readings of a photograph, for the gallery.'
  s.description    = 'Aesthetics score, utility flag and measured signals for one image.'
  s.author         = 'City Crew'
  s.homepage       = 'https://github.com/aletuan/city-crew'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
