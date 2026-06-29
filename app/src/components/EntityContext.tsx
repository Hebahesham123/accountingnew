"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Entity, Profile } from "@/lib/types";

interface Ctx {
  entities: Entity[];
  entity: Entity | null;
  setEntityId: (id: string) => void;
  profile: Profile | null;
  loading: boolean;
  reloadEntities: () => Promise<void>;
}

const EntityCtx = createContext<Ctx>({
  entities: [],
  entity: null,
  setEntityId: () => {},
  profile: null,
  loading: true,
  reloadEntities: async () => {},
});

export function EntityProvider({ children }: { children: React.ReactNode }) {
  const sb = supabaseBrowser();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityIdState] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const setEntityId = useCallback((id: string) => {
    setEntityIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("entityId", id);
  }, []);

  const reloadEntities = useCallback(async () => {
    const { data } = await sb.from("entities").select("*").order("created_at");
    const list = (data as Entity[]) ?? [];
    setEntities(list);
    const saved = typeof window !== "undefined" ? localStorage.getItem("entityId") : null;
    setEntityIdState((cur) => {
      if (cur && list.some((e) => e.id === cur)) return cur;
      if (saved && list.some((e) => e.id === saved)) return saved;
      return list[0]?.id ?? null;
    });
  }, [sb]);

  useEffect(() => {
    (async () => {
      const { data: u } = await sb.auth.getUser();
      if (u.user) {
        const { data: p } = await sb.from("profiles").select("*").eq("id", u.user.id).single();
        setProfile(p as Profile);
      }
      await reloadEntities();
      setLoading(false);
    })();
  }, [sb, reloadEntities]);

  const entity = entities.find((e) => e.id === entityId) ?? null;

  return (
    <EntityCtx.Provider value={{ entities, entity, setEntityId, profile, loading, reloadEntities }}>
      {children}
    </EntityCtx.Provider>
  );
}

export const useEntity = () => useContext(EntityCtx);
