import { useEffect } from 'react';
import { PixelArrow } from '@/components/PixelArrow';
import { holdMusic, logoUrl, nextSong, songs, startMusic, toggleMusic, useMusic } from '@/world/music';
import '@/styles/music.css';

type MusicPlayerProps = {
  /** Shown once the visitor is past the title screen. */
  visible: boolean;
};

const isNewTabLink = (target: EventTarget | null) => target instanceof Element && target.closest('a[target="_blank"]') !== null;

/** The note the player shows until music/logo.* exists: 8 x 8 pixels. */
function NoteIcon() {
  return (
    <svg className="music__note" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="currentColor" d="M3 0h4v1H3zM3 1h1v4H3zM6 1h1v3H6zM1 4h2v2H1zM0 5h1v1H0zM4 3h2v2H4zM5 2h1v1H5z" />
    </svg>
  );
}

/**
 * The music player in the top-left corner: the picture, the song's name, NEXT and the on/off
 * switch. With no songs in the music folders it is not there at all.
 */
export function MusicPlayer({ visible }: MusicPlayerProps) {
  const { index, on, playing } = useMusic();
  const song = songs[index];

  // Someone who arrives on a link to a room never presses START: their first click or key in the
  // world starts the music instead. A link that opens another tab does not count.
  useEffect(() => {
    if (!songs.length || !visible) return;
    const onGesture = (event: Event) => {
      if (isNewTabLink(event.target)) return;
      if (event.target instanceof Element && event.target.closest('.music')) return; // its own buttons decide
      startMusic();
    };
    window.addEventListener('click', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    return () => {
      window.removeEventListener('click', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    };
  }, [visible]);

  // A hidden tab does not keep playing.
  useEffect(() => {
    const onVisibility = () => holdMusic(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!song || !visible) return null;

  return (
    <section className="music pixel-box" aria-label="Music" data-music="" data-playing={playing ? '' : undefined}>
      <span className="music__logo" aria-hidden="true">
        {logoUrl ? <img src={logoUrl} alt="" draggable={false} /> : <NoteIcon />}
      </span>
      <p className="music__song">
        <span className="music__title" data-music-title="">
          {song.title}
        </span>
        {song.from && <span className="music__from">{song.from}</span>}
        {song.local && (
          <span className="music__local" title="This song is in music/private: it plays on this computer only">
            Local
          </span>
        )}
      </p>
      <button type="button" className="music__button" onClick={nextSong} aria-label="Next song" title="Next song" data-music-next="">
        <PixelArrow />
        <PixelArrow />
      </button>
      <button
        type="button"
        className="music__button music__switch"
        onClick={toggleMusic}
        aria-pressed={on}
        aria-label="Music"
        title={on ? 'Turn the music off' : 'Turn the music on'}
        data-music-switch=""
      >
        {on ? 'On' : 'Off'}
      </button>
    </section>
  );
}
