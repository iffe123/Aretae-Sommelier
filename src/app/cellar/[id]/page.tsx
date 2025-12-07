"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Wine } from "@/types/wine";
import { getWine, updateWine } from "@/lib/wine-service";
import WineDetail from "@/components/wine/WineDetail";
import WineForm from "@/components/wine/WineForm";
import Modal from "@/components/ui/Modal";
import { Wine as WineIcon } from "lucide-react";

interface WineDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function WineDetailPage({ params }: WineDetailPageProps) {
  const resolvedParams = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [wine, setWine] = useState<Wine | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function loadWine() {
      if (!user || !resolvedParams.id) return;
      setLoading(true);
      try {
        const data = await getWine(resolvedParams.id);
        if (data && data.userId === user.uid) {
          setWine(data);
        } else {
          router.push("/cellar");
        }
      } catch (error) {
        console.error("Error loading wine:", error);
        router.push("/cellar");
      } finally {
        setLoading(false);
      }
    }
    loadWine();
  }, [user, resolvedParams.id, router]);

  const handleUpdateWine = async (data: Parameters<typeof updateWine>[1]) => {
    if (!wine) return;
    try {
      await updateWine(wine.id, data, wine.photoUrl);
      const updatedWine = await getWine(wine.id);
      if (updatedWine) {
        setWine(updatedWine);
      }
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating wine:", error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wine-50">
        <div className="animate-pulse">
          <WineIcon className="w-12 h-12 text-wine-400" />
        </div>
      </div>
    );
  }

  if (!wine) {
    return null;
  }

  return (
    <>
      <WineDetail wine={wine} onEdit={() => setShowEditModal(true)} />

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Wine"
      >
        <div className="max-h-[70vh] overflow-y-auto -mx-6 px-6">
          <WineForm
            initialData={wine}
            onSubmit={handleUpdateWine}
            onCancel={() => setShowEditModal(false)}
          />
        </div>
      </Modal>
    </>
  );
}
