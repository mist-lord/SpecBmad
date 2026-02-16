import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Captions } from './Captions';

const Background: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, -160]);
  const glowShift = interpolate(frame, [0, durationInFrames], [0, 220]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0B1020',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.25), transparent 35%)',
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 70% 30%, rgba(56,189,248,0.18), transparent 45%), radial-gradient(circle at 15% 80%, rgba(129,140,248,0.2), transparent 40%)',
          transform: `translate3d(${drift}px, ${-drift * 0.5}px, 0)`,
        }}
      />
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          opacity: 0.6,
          background:
            'linear-gradient(120deg, rgba(14,165,233,0.08), rgba(59,130,246,0.12), rgba(14,165,233,0.08))',
          transform: `translate3d(${glowShift}px, 0, 0)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

const TitleScene: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - start);
  const scale = 0.95 + 0.05 * spring({ frame: t, fps, config: { damping: 200 } });
  const opacity = interpolate(t, [0, 20, 80], [0, 1, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ opacity, transform: `scale(${scale})` }}>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: 1 }}>SpecBmad</div>
        <div style={{ fontSize: 28, marginTop: 20, color: 'rgba(255,255,255,0.75)' }}>
          AI 驱动的软件开发工作流工具
        </div>
      </div>
    </AbsoluteFill>
  );
};

const HighlightsScene: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - start);
  const titleOpacity = interpolate(t, [0, 16], [0, 1], { extrapolateRight: 'clamp' });

  const items = [
    '多角色智能体协作（分析/架构/开发/测试）',
    '分阶段工作流与质量门禁',
    '变更管理与可追溯报告',
    '支持 TypeScript / Python / C++',
  ];

  return (
    <AbsoluteFill style={{ padding: '120px 160px' }}>
      <div style={{ fontSize: 48, fontWeight: 700, opacity: titleOpacity }}>核心能力</div>
      <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {items.map((text, index) => {
          const itemT = t - index * 8;
          const opacity = interpolate(itemT, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
          const x = interpolate(itemT, [0, 14], [40, 0], { extrapolateRight: 'clamp' });
          return (
            <div
              key={text}
              style={{
                fontSize: 30,
                opacity,
                transform: `translateX(${x}px)`,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              {text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ArchitectureScene: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - start);
  const opacity = interpolate(t, [0, 18, 80], [0, 1, 1], { extrapolateRight: 'clamp' });
  const scale = 0.96 + 0.04 * spring({ frame: t, fps, config: { damping: 200 } });

  const stats = [
    { label: '工作流阶段', value: '需求 → 设计 → 实现 → 验证 → 发布' },
    { label: '自动化能力', value: '规范生成、测试、报告、可视化' },
    { label: '目标', value: '降低交付风险，提升工程确定性' },
  ];

  return (
    <AbsoluteFill style={{ padding: '120px 160px', justifyContent: 'center' }}>
      <div style={{ opacity, transform: `scale(${scale})` }}>
        <div style={{ fontSize: 46, fontWeight: 700 }}>架构价值</div>
        <div style={{ marginTop: 36, display: 'grid', gap: 22 }}>
          {stats.map((item) => (
            <div
              key={item.label}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 16,
                padding: '18px 22px',
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)' }}>{item.label}</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ClosingScene: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - start);
  const opacity = interpolate(t, [0, 18, 120], [0, 1, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(t, [0, 28], [24, 0], { extrapolateRight: 'clamp' });
  const glow = 0.6 + 0.4 * spring({ frame: t, fps, config: { damping: 120 } });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          padding: '36px 48px',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(10,14,30,0.6)',
          boxShadow: `0 0 40px rgba(56,189,248,${glow})`,
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700 }}>让交付更稳、更快、更可控</div>
        <div style={{ fontSize: 22, marginTop: 16, color: 'rgba(255,255,255,0.75)' }}>
          SpecBmad · Spec-Driven AI Engineering
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Intro: React.FC = () => {
  const { fps } = useVideoConfig();
  const titleDuration = 6 * fps;
  const highlightDuration = 10 * fps;
  const architectureDuration = 10 * fps;
  const closingDuration = 9 * fps;
  const totalDuration = titleDuration + highlightDuration + architectureDuration + closingDuration;
  const zhDuration = Math.round(18.659 * fps);
  const enDuration = Math.round(15.652 * fps);

  return (
    <Background>
      <Sequence from={0} durationInFrames={totalDuration}>
        <Audio src={staticFile('remotion/voiceover-zh.wav')} />
      </Sequence>
      <Sequence from={zhDuration} durationInFrames={enDuration + closingDuration}>
        <Audio src={staticFile('remotion/voiceover-en.wav')} />
      </Sequence>
      <Sequence from={0} durationInFrames={titleDuration}>
        <TitleScene start={0} />
      </Sequence>
      <Sequence from={titleDuration} durationInFrames={highlightDuration}>
        <HighlightsScene start={titleDuration} />
      </Sequence>
      <Sequence from={titleDuration + highlightDuration} durationInFrames={architectureDuration}>
        <ArchitectureScene start={titleDuration + highlightDuration} />
      </Sequence>
      <Sequence
        from={titleDuration + highlightDuration + architectureDuration}
        durationInFrames={closingDuration}
      >
        <ClosingScene start={titleDuration + highlightDuration + architectureDuration} />
      </Sequence>
      <Captions />
    </Background>
  );
};
