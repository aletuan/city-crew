// Catches a native map module that mounts and then throws.
//
// A class, because this is the one thing hooks cannot do. There is no
// retry: if the map failed once on this device it will fail again, and
// offering a button that re-crashes the screen is not a kindness.
//
// `PlacesMap` and `MiniMap` held a copy each. They had already drifted in
// formatting, which is how a pair like this announces that it is about to
// drift in behaviour — improve the fallback in one and the other screen
// keeps the old one, and nobody finds out until a reader reports a blank
// map on exactly one screen.
//
// Deliberately not a general-purpose error boundary. "Render nothing, and
// never try again" is right for a map the rest of the screen can do
// without, and wrong for almost anything else; a screen whose content IS
// the thing that failed needs to say so, not fall silent.
import React from 'react';

export default class MapBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
