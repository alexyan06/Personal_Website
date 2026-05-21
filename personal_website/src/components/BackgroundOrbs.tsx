interface Props {
  dark: boolean;
}

export const BackgroundOrbs = ({ dark }: Props) => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        style={{
          position: 'absolute',
          width: '520px',
          height: '520px',
          top: '-120px',
          left: '-80px',
          borderRadius: '50%',
          filter: 'blur(110px)',
          background: dark ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.055)',
          animation: 'float-slow 20s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '580px',
          height: '580px',
          bottom: '-140px',
          right: '-120px',
          borderRadius: '50%',
          filter: 'blur(130px)',
          background: dark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.045)',
          animation: 'float-medium 24s ease-in-out infinite',
          animationDelay: '-9s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '380px',
          height: '380px',
          top: '45%',
          left: '38%',
          borderRadius: '50%',
          filter: 'blur(160px)',
          background: dark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(219, 234, 254, 0.5)',
          animation: 'float-slow 28s ease-in-out infinite',
          animationDelay: '-14s',
        }}
      />
    </div>
  );
};
