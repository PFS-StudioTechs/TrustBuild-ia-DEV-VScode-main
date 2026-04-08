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
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller with anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin using service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Accès refusé: admin requis" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ACTION: list_users — get all users with profiles and roles
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
        profile: profiles?.find((p) => p.user_id === u.id) || null,
        roles: (roles || []).filter((r) => r.user_id === u.id).map((r) => r.role),
      }));

      return new Response(JSON.stringify({ users: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: list_chantiers — get ALL chantiers with client info
    if (action === "list_chantiers") {
      const { data: chantiers, error } = await adminClient
        .from("chantiers")
        .select("*, clients(nom, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get profiles for artisan names
      const artisanIds = [...new Set((chantiers || []).map((c) => c.artisan_id))];
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, nom, prenom")
        .in("user_id", artisanIds);

      const enriched = (chantiers || []).map((c) => ({
        ...c,
        artisan: profiles?.find((p) => p.user_id === c.artisan_id) || null,
      }));

      return new Response(JSON.stringify({ chantiers: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: update_role
    if (action === "update_role") {
      const { user_id, role } = body;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id et role requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent removing own admin role
      if (user_id === caller.id && role !== "admin") {
        return new Response(JSON.stringify({ error: "Impossible de retirer votre propre rôle admin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove existing roles and set new one
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await adminClient.from("user_roles").insert({ user_id, role });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: update_profile
    if (action === "update_profile") {
      const { user_id, updates } = body;
      if (!user_id || !updates) {
        return new Response(JSON.stringify({ error: "user_id et updates requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    // ACTION: delete_user
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Impossible de supprimer votre propre compte" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
