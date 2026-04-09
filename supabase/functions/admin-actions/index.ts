import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Decode JWT payload — Supabase edge runtime already verified the signature
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let callerId: string;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      callerId = payload.sub;
      if (!callerId) throw new Error("sub manquant");
    } catch {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Determine caller's privilege level
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const callerRoleNames = (callerRoles || []).map((r: { role: string }) => r.role);
    const callerIsAdmin = callerRoleNames.includes("admin") || callerRoleNames.includes("super_admin");
    const callerIsSuperAdmin = callerRoleNames.includes("super_admin");

    if (!callerIsAdmin) {
      return new Response(JSON.stringify({ error: "Accès refusé : admin requis" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // -------------------------------------------------------------------------
    // list_users — visible to all admins
    // -------------------------------------------------------------------------
    if (action === "list_users") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const { data: profiles } = await adminClient.from("profiles").select("*");
      const { data: roles } = await adminClient.from("user_roles").select("*");

      const enriched = users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        profile: profiles?.find((p: { user_id: string }) => p.user_id === u.id) || null,
        roles: (roles || [])
          .filter((r: { user_id: string }) => r.user_id === u.id)
          .map((r: { role: string }) => r.role),
      }));

      return new Response(JSON.stringify({ users: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // list_chantiers — visible to all admins
    // -------------------------------------------------------------------------
    if (action === "list_chantiers") {
      const { data: chantiers, error } = await adminClient
        .from("chantiers")
        .select("*, clients(nom, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const artisanIds = [...new Set((chantiers || []).map((c: { artisan_id: string }) => c.artisan_id))];
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, nom, prenom")
        .in("user_id", artisanIds);

      const enriched = (chantiers || []).map((c: Record<string, unknown>) => ({
        ...c,
        artisan: profiles?.find((p: { user_id: string }) => p.user_id === c.artisan_id) || null,
      }));

      return new Response(JSON.stringify({ chantiers: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // update_role
    // -------------------------------------------------------------------------
    if (action === "update_role") {
      const { user_id, role } = body;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id et role requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cannot change your own role
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Impossible de modifier votre propre rôle" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only super_admin can assign super_admin role
      if (role === "super_admin" && !callerIsSuperAdmin) {
        return new Response(JSON.stringify({ error: "Seul un super admin peut attribuer ce rôle" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check target's current roles
      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);
      const targetRoleNames = (targetRoles || []).map((r: { role: string }) => r.role);
      const targetIsAdminOrAbove = targetRoleNames.some(
        (r: string) => r === "admin" || r === "super_admin"
      );

      // Only super_admin can change the role of an admin/super_admin
      if (targetIsAdminOrAbove && !callerIsSuperAdmin) {
        return new Response(
          JSON.stringify({ error: "Seul un super admin peut modifier le rôle d'un administrateur" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      // Always keep artisan role alongside admin/super_admin
      const rolesToInsert =
        role === "artisan"
          ? [{ user_id, role: "artisan" }]
          : [
              { user_id, role },
              { user_id, role: "artisan" },
            ];
      const { error } = await adminClient.from("user_roles").insert(rolesToInsert);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // update_profile — admin can update any artisan, super_admin can update anyone
    // -------------------------------------------------------------------------
    if (action === "update_profile") {
      const { user_id, updates } = body;
      if (!user_id || !updates) {
        return new Response(JSON.stringify({ error: "user_id et updates requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check target roles
      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);
      const targetRoleNames = (targetRoles || []).map((r: { role: string }) => r.role);
      const targetIsAdminOrAbove = targetRoleNames.some(
        (r: string) => r === "admin" || r === "super_admin"
      );

      if (targetIsAdminOrAbove && !callerIsSuperAdmin) {
        return new Response(
          JSON.stringify({ error: "Seul un super admin peut modifier le profil d'un administrateur" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allowedFields = ["nom", "prenom", "siret", "plan_abonnement"];
      const safeUpdates: Record<string, string> = {};
      for (const key of allowedFields) {
        if (key in updates) safeUpdates[key] = updates[key];
      }

      const { error } = await adminClient
        .from("profiles")
        .update(safeUpdates)
        .eq("user_id", user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // delete_user — admin cannot delete other admins
    // -------------------------------------------------------------------------
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Impossible de supprimer votre propre compte" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);
      const targetRoleNames = (targetRoles || []).map((r: { role: string }) => r.role);
      const targetIsAdminOrAbove = targetRoleNames.some(
        (r: string) => r === "admin" || r === "super_admin"
      );

      if (targetIsAdminOrAbove && !callerIsSuperAdmin) {
        return new Response(
          JSON.stringify({ error: "Seul un super admin peut supprimer un administrateur" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
