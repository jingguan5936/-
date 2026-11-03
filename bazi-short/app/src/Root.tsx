import React from "react";
import { Composition } from "remotion";
import { BaziShort, BAZI_FRAMES } from "./videos/bazi/Bazi";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BaziShort" component={BaziShort} durationInFrames={BAZI_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
