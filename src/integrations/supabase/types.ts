export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_configurations: {
        Row: {
          created_at: string
          environment: string
          id: string
          is_active: boolean
          service_name: string
          updated_at: string
          vault_secret_name: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          service_name: string
          updated_at?: string
          vault_secret_name: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          service_name?: string
          updated_at?: string
          vault_secret_name?: string
        }
        Relationships: []
      }
      artisan_settings: {
        Row: {
          coordonnees_bancaires: Json
          created_at: string
          id: string
          preferences: Json
          signature_electronique_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coordonnees_bancaires?: Json
          created_at?: string
          id?: string
          preferences?: Json
          signature_electronique_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coordonnees_bancaires?: Json
          created_at?: string
          id?: string
          preferences?: Json
          signature_electronique_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          artisan_id: string
          created_at: string
          id: string
          payload_input: Json
          payload_output: Json
          statut: Database["public"]["Enums"]["automation_statut"]
          type_action: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          artisan_id: string
          created_at?: string
          id?: string
          payload_input?: Json
          payload_output?: Json
          statut?: Database["public"]["Enums"]["automation_statut"]
          type_action: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          artisan_id?: string
          created_at?: string
          id?: string
          payload_input?: Json
          payload_output?: Json
          statut?: Database["public"]["Enums"]["automation_statut"]
          type_action?: string
          updated_at?: string
        }
        Relationships: []
      }
      avenants: {
        Row: {
          artisan_id: string
          created_at: string
          date: string
          description: string
          devis_id: string
          id: string
          montant_ht: number
          statut: Database["public"]["Enums"]["devis_statut"]
          updated_at: string
        }
        Insert: {
          artisan_id: string
          created_at?: string
          date?: string
          description: string
          devis_id: string
          id?: string
          montant_ht?: number
          statut?: Database["public"]["Enums"]["devis_statut"]
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string
          date?: string
          description?: string
          devis_id?: string
          id?: string
          montant_ht?: number
          statut?: Database["public"]["Enums"]["devis_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avenants_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      chantiers: {
        Row: {
          adresse_chantier: string | null
          artisan_id: string
          client_id: string
          created_at: string
          date_debut: string | null
          date_fin_prevue: string | null
          id: string
          nom: string
          statut: Database["public"]["Enums"]["chantier_statut"]
          updated_at: string
        }
        Insert: {
          adresse_chantier?: string | null
          artisan_id: string
          client_id: string
          created_at?: string
          date_debut?: string | null
          date_fin_prevue?: string | null
          id?: string
          nom: string
          statut?: Database["public"]["Enums"]["chantier_statut"]
          updated_at?: string
        }
        Update: {
          adresse_chantier?: string | null
          artisan_id?: string
          client_id?: string
          created_at?: string
          date_debut?: string | null
          date_fin_prevue?: string | null
          id?: string
          nom?: string
          statut?: Database["public"]["Enums"]["chantier_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          artisan_id: string
          created_at: string
          id: string
          titre: string
          updated_at: string
        }
        Insert: {
          artisan_id: string
          created_at?: string
          id?: string
          titre?: string
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string
          id?: string
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          artisan_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          persona: string | null
          role: string
          source: string
          transcription_originale: string | null
        }
        Insert: {
          artisan_id: string
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          persona?: string | null
          role?: string
          source?: string
          transcription_originale?: string | null
        }
        Update: {
          artisan_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          persona?: string | null
          role?: string
          source?: string
          transcription_originale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          artisan_id: string
          created_at: string
          email: string | null
          id: string
          nom: string
          telephone: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          artisan_id: string
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          telephone?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          artisan_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          telephone?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Relationships: []
      }
      devis: {
        Row: {
          artisan_id: string
          chantier_id: string
          created_at: string
          date_validite: string | null
          facturx_ready: boolean
          id: string
          montant_ht: number
          numero: string
          statut: Database["public"]["Enums"]["devis_statut"]
          tva: number
          updated_at: string
        }
        Insert: {
          artisan_id: string
          chantier_id: string
          created_at?: string
          date_validite?: string | null
          facturx_ready?: boolean
          id?: string
          montant_ht?: number
          numero: string
          statut?: Database["public"]["Enums"]["devis_statut"]
          tva?: number
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          chantier_id?: string
          created_at?: string
          date_validite?: string | null
          facturx_ready?: boolean
          id?: string
          montant_ht?: number
          numero?: string
          statut?: Database["public"]["Enums"]["devis_statut"]
          tva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          artisan_id: string
          chantier_id: string | null
          client_id: string | null
          created_at: string
          description: string | null
          est_archive: boolean
          fournisseur_id: string | null
          id: string
          mime_type: string
          nom: string
          storage_path: string
          tags: string[]
          taille_octets: number
          type_fichier: string
          updated_at: string
        }
        Insert: {
          artisan_id: string
          chantier_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          est_archive?: boolean
          fournisseur_id?: string | null
          id?: string
          mime_type?: string
          nom: string
          storage_path: string
          tags?: string[]
          taille_octets?: number
          type_fichier?: string
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          chantier_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          est_archive?: boolean
          fournisseur_id?: string | null
          id?: string
          mime_type?: string
          nom?: string
          storage_path?: string
          tags?: string[]
          taille_octets?: number
          type_fichier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          artisan_id: string
          created_at: string
          date_echeance: string
          devis_id: string
          id: string
          montant_ht: number
          numero: string
          solde_restant: number
          statut: Database["public"]["Enums"]["facture_statut"]
          tva: number
          updated_at: string
        }
        Insert: {
          artisan_id: string
          created_at?: string
          date_echeance: string
          devis_id: string
          id?: string
          montant_ht?: number
          numero: string
          solde_restant?: number
          statut?: Database["public"]["Enums"]["facture_statut"]
          tva?: number
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string
          date_echeance?: string
          devis_id?: string
          id?: string
          montant_ht?: number
          numero?: string
          solde_restant?: number
          statut?: Database["public"]["Enums"]["facture_statut"]
          tva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          api_config_id: string | null
          artisan_id: string
          contact: string | null
          created_at: string
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          api_config_id?: string | null
          artisan_id: string
          contact?: string | null
          created_at?: string
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          api_config_id?: string | null
          artisan_id?: string
          contact?: string | null
          created_at?: string
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          artisan_id: string
          created_at: string
          date: string
          facture_id: string
          id: string
          mode: string
          montant: number
          reference_transaction: string | null
        }
        Insert: {
          artisan_id: string
          created_at?: string
          date?: string
          facture_id: string
          id?: string
          mode?: string
          montant: number
          reference_transaction?: string | null
        }
        Update: {
          artisan_id?: string
          created_at?: string
          date?: string
          facture_id?: string
          id?: string
          mode?: string
          montant?: number
          reference_transaction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          nom: string
          plan_abonnement: Database["public"]["Enums"]["plan_abonnement"]
          prenom: string
          siret: string | null
          updated_at: string
          user_id: string
          raison_sociale: string | null
          nom_commercial: string | null
          adresse: string | null
          code_postal: string | null
          ville: string | null
          pays: string | null
          activite: string | null
          forme_juridique: string | null
          profile_completed: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nom?: string
          plan_abonnement?: Database["public"]["Enums"]["plan_abonnement"]
          prenom?: string
          siret?: string | null
          updated_at?: string
          user_id: string
          raison_sociale?: string | null
          nom_commercial?: string | null
          adresse?: string | null
          code_postal?: string | null
          ville?: string | null
          pays?: string | null
          activite?: string | null
          forme_juridique?: string | null
          profile_completed?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nom?: string
          plan_abonnement?: Database["public"]["Enums"]["plan_abonnement"]
          prenom?: string
          siret?: string | null
          updated_at?: string
          user_id?: string
          raison_sociale?: string | null
          nom_commercial?: string | null
          adresse?: string | null
          code_postal?: string | null
          ville?: string | null
          pays?: string | null
          activite?: string | null
          forme_juridique?: string | null
          profile_completed?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "artisan"
      automation_statut: "pending" | "approved" | "sent"
      chantier_statut: "prospect" | "en_cours" | "termine" | "litige"
      client_type: "particulier" | "pro"
      devis_statut: "brouillon" | "envoye" | "signe" | "refuse"
      facture_statut: "brouillon" | "envoyee" | "payee" | "impayee"
      plan_abonnement: "gratuit" | "starter" | "pro" | "enterprise"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "artisan"],
      automation_statut: ["pending", "approved", "sent"],
      chantier_statut: ["prospect", "en_cours", "termine", "litige"],
      client_type: ["particulier", "pro"],
      devis_statut: ["brouillon", "envoye", "signe", "refuse"],
      facture_statut: ["brouillon", "envoyee", "payee", "impayee"],
      plan_abonnement: ["gratuit", "starter", "pro", "enterprise"],
    },
  },
} as const
