import { AlertCircle } from "lucide-react";

export default async function InstanceDetailsCatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const decodedPath = slug.map(decodeURIComponent).join(" / ");

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 rounded-full bg-accent-orange/10 flex items-center justify-center mb-4">
        <AlertCircle size={32} className="text-accent-orange" />
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Configuration Missing
      </h2>
      <p className="text-sm text-text-secondary mb-6 max-w-md">
        The capability for <span className="font-semibold text-text-primary">"{decodedPath}"</span> is not configured. Kindly contact with admin.
      </p>
    </div>
  );
}
