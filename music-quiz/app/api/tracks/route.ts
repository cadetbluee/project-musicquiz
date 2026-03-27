export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre") || "k-pop";

  // Deezer API는 로그인 없이 바로 호출 가능
  const response = await fetch(
    `https://api.deezer.com/search?q=genre:"${genre}"&limit=50`
  );

  const data = await response.json();

  // preview 없는 곡 필터링
  const tracks = data.data
    .filter((track: any) => track.preview !== "")
    .map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      previewUrl: track.preview, // 30초 미리듣기 mp3 URL
      albumImage: track.album.cover_medium,
    }));

  return Response.json({ tracks });
}
