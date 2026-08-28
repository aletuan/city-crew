// Image imports, which Metro resolves to an asset and TypeScript does not
// know about on its own — expo's base config declares no module for them.
//
// `number` is what the bundler actually hands back: a registry id to pass
// to a component's `source`, never a value to reach into. (Under the test
// runner the same import resolves to a URL string instead, which every
// image component here also accepts; nothing typechecks that path.)
declare module '*.png' {
  const asset: number;
  export default asset;
}
