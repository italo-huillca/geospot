import InfoPanel from '@/components/InfoPanel';
import MapView from '@/components/MapView';
import SidePanel from '@/components/SidePanel';
import Toasts from '@/components/Toasts';

export default function ExplorePage() {
  return (
    <div className="relative h-dvh overflow-hidden">
      <MapView />
      <SidePanel />
      <InfoPanel />
      <Toasts />
    </div>
  );
}
