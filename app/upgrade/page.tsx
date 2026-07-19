export default function UpgradePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1b2a] text-[#f5f0e8] px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-[#c9a552] mb-4">
          L&apos;app Flashcard est réservée aux formules Pro et Élite
        </h1>
        <p className="text-sm text-[#a7bcb7] mb-8">
          Ton abonnement actuel n&apos;inclut pas l&apos;accès à cette app.
          Passe à la formule Pro ou Élite depuis fulfiency.fr pour la débloquer.
        </p>
        <a
          href="https://fulfiency.fr"
          className="inline-block bg-gradient-to-r from-[#c9a552] to-[#eaa93d] text-[#0d1b2a] font-semibold px-8 py-3 rounded-lg"
        >
          Voir les formules
        </a>
      </div>
    </div>
  );
}
