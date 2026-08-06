import React from 'react';
import { Composition } from 'remotion';
import { PitchVertical, DURATION } from './PitchVertical';
import { FPS } from './beats';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PitchVertical"
    component={PitchVertical}
    durationInFrames={DURATION}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
