import NavBar from "@/components/ui/NavBar";
import ParticlesCanvas from "@/components/ui/ParticlesCanvas";
import GlobalSearch from "@/components/ui/GlobalSearch";
import ThemeProvider from "@/components/ui/ThemeProvider";
import GlobalShortcuts from "@/components/ui/GlobalShortcuts";
import QuickAddCard from "@/components/ui/QuickAddCard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProvider />
      <GlobalShortcuts />
      <ParticlesCanvas />
      <NavBar />
      <GlobalSearch />
      <QuickAddCard />
      <main className="relative z-10 flex-1 px-4 sm:px-8 py-6 pb-20 sm:pb-6 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </>
  );
}
