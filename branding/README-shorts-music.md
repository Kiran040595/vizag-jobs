# Background music for YouTube Shorts (optional)

Place a **royalty-free MP3** here:

```
branding/shorts-music.mp3
```

The daily Short pipeline loops this track quietly under the voice-over.

## Tips

- Use a calm, upbeat instrumental (30–60 seconds is enough — it will loop).
- Good free sources: [YouTube Audio Library](https://studio.youtube.com/channel/UC/music), Pixabay, Uppbeat.
- Keep volume reasonable; the script mixes music at ~14% by default.

## Override path

```env
AUTO_YOUTUBE_SHORT_MUSIC_PATH=branding/my-custom-track.mp3
AUTO_YOUTUBE_SHORT_MUSIC_VOLUME=0.12
```

If no music file exists, the Short is uploaded with **voice-over only**.
