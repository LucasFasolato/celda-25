import TeamTerminal from "@/components/TeamTerminal";

export default async function CeldaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TeamTerminal token={token} />;
}
