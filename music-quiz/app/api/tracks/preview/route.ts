export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre") || "k-pop";

  const tagMap: Record<string, string> = {
    "k-pop": "k-pop",
    pop: "pop",
    "hip-hop": "hip-hop",
    rock: "rock",
  };

  const tag = tagMap[genre] || "k-pop";

  // Last.fm 차트
  const lastfmRes = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${tag}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=30`
  );
  const lastfmData = await lastfmRes.json();
  const tracks = lastfmData.tracks?.track;

  if (!tracks) {
    return Response.json({ error: "Last.fm 응답 없음", raw: lastfmData });
  }

  // Deezer 매칭
  const results = await Promise.all(
    tracks.map(async (track: any) => {
      const query = `${track.name} ${track.artist.name}`;
      const deezerRes = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`
      );
      const deezerData = await deezerRes.json();
      const deezerTrack = deezerData.data?.[0];

      return {
        title: track.name,
        artist: track.artist.name,
        hasPreview: !!deezerTrack?.preview, // 미리듣기 있는지 여부
        previewUrl: deezerTrack?.preview || null,
        albumImage: deezerTrack?.album.cover_medium || null,
      };
    })
  );

  const matched = results.filter((r) => r.hasPreview);

  return Response.json({
    total: results.length,
    matched: matched.length, // 미리듣기 매칭된 곡 수
    tracks: results, // 전체 목록 (hasPreview로 구분)
  });
}
