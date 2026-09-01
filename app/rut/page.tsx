import { RutWizard } from "@/components/RutWizard";

type Props = {
  searchParams: Promise<{ step?: string }>;
};

export default async function RutPage({ searchParams }: Props) {
  const params = await searchParams;
  const step = Number(params.step ?? "1");
  return (
    <div className="bg-mza-bg pb-16">
      <RutWizard initialStep={Number.isFinite(step) ? step : 1} />
    </div>
  );
}
