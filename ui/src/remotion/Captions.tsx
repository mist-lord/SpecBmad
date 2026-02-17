import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useDelayRender,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import type { Caption } from '@remotion/captions';

const Box: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 80,
        right: 80,
        bottom: 80,
        padding: '18px 24px',
        background: 'rgba(8,12,24,0.6)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 16,
        backdropFilter: 'blur(6px)',
      }}
    >
      {children}
    </div>
  );
};

const CaptionCard: React.FC<{ text: string; progress: number }> = ({ text, progress }) => {
  const y = interpolate(progress, [0, 1], [18, 0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(progress, [0, 0.2, 1], [0, 1, 1], { extrapolateRight: 'clamp' });
  const glow = interpolate(progress, [0, 1], [0.2, 0.8], { extrapolateRight: 'clamp' });

  return (
    <Box>
      <div style={{ transform: `translateY(${y}px)`, opacity }}>
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            textAlign: 'center',
            whiteSpace: 'pre-line',
            color: 'rgba(255,255,255,0.92)',
            textShadow: `0 0 16px rgba(56,189,248,${glow})`,
          }}
        >
          {text}
        </div>
      </div>
    </Box>
  );
};

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender());

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile('remotion/captions.json'));
      const data = (await response.json()) as Caption[];
      setCaptions(data);
      continueRender(handle);
    } catch (error) {
      cancelRender(error);
    }
  }, [cancelRender, continueRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  const pages = useMemo(() => captions ?? [], [captions]);

  return (
    <AbsoluteFill>
      {pages.map((caption, index) => {
        const startFrame = Math.round((caption.startMs / 1000) * fps);
        const endFrame = Math.round((caption.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);
        const localFrame = frame - startFrame;
        const progress = Math.min(1, Math.max(0, localFrame / durationInFrames));

        return (
          <Sequence key={`${caption.startMs}-${index}`} from={startFrame} durationInFrames={durationInFrames}>
            <CaptionCard text={caption.text} progress={progress} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
