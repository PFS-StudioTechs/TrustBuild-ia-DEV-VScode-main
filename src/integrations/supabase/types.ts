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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      acomptes: {
        Row: {
          artisan_id: string
          created_at: string | null
          date_echeance: string | null
          date_encaissement: string | null
          devis_id: string
          id: string
          montant: number
          notes: string | null
          numero: string
          pourcentage: number | null
          statut: string
          updated_at: string | null
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          date_echeance?: string | null
          date_encaissement?: string | null
          devis_id: string
          id?: string
          montant?: number
          notes?: string | null
          numero?: string
          pourcentage?: number | null
          statut?: string
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          date_echeance?: string | null
          date_encaissement?: string | null
          devis_id?: string
          id?: string
          montant?: number
          notes?: string | null
          numero?: string
          pourcentage?: number | null
          statut?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acomptes_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
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
      app_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          status: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      artisan_prix_negocie: {
        Row: {
          artisan_id: string
          id: string
          prix_negocie_valeur: number | null
          produit_id: string
          updated_at: string | null
        }
        Insert: {
          artisan_id: string
          id?: string
          prix_negocie_valeur?: number | null
          produit_id: string
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string
          id?: string
          prix_negocie_valeur?: number | null
          produit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_prix_negocie_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_settings: {
        Row: {
          acompte_prefix: string
          annee_format: number
          avenant_prefix: string
          avoir_prefix: string
          coordonnees_bancaires: Json
          created_at: string
          devis_prefix: string
          facture_prefix: string
          id: string
          numero_digits: number
          preferences: Json
          signature_electronique_url: string | null
          ts_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acompte_prefix?: string
          annee_format?: number
          avenant_prefix?: string
          avoir_prefix?: string
          coordonnees_bancaires?: Json
          created_at?: string
          devis_prefix?: string
          facture_prefix?: string
          id?: string
          numero_digits?: number
          preferences?: Json
          signature_electronique_url?: string | null
          ts_prefix?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acompte_prefix?: string
          annee_format?: number
          avenant_prefix?: string
          avoir_prefix?: string
          coordonnees_bancaires?: Json
          created_at?: string
          devis_prefix?: string
          facture_prefix?: string
          id?: string
          numero_digits?: number
          preferences?: Json
          signature_electronique_url?: string | null
          ts_prefix?: string
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
          numero: string | null
          original_pdf_generated_at: string | null
          original_pdf_path: string | null
          statut: Database["public"]["Enums"]["devis_statut"]
          token_expires_at: string | null
          token_public: string
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
          numero?: string | null
          original_pdf_generated_at?: string | null
          original_pdf_path?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          token_expires_at?: string | null
          token_public?: string
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
          numero?: string | null
          original_pdf_generated_at?: string | null
          original_pdf_path?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          token_expires_at?: string | null
          token_public?: string
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
      avoirs: {
        Row: {
          artisan_id: string
          created_at: string | null
          date: string
          description: string
          devis_id: string | null
          facture_id: string | null
          facture_remplacante_id: string | null
          id: string
          montant_ht: number
          numero: string
          statut: string
          tva: number
          updated_at: string | null
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          date?: string
          description?: string
          devis_id?: string | null
          facture_id?: string | null
          facture_remplacante_id?: string | null
          id?: string
          montant_ht?: number
          numero: string
          statut?: string
          tva?: number
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          date?: string
          description?: string
          devis_id?: string | null
          facture_id?: string | null
          facture_remplacante_id?: string | null
          id?: string
          montant_ht?: number
          numero?: string
          statut?: string
          tva?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avoirs_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoirs_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoirs_facture_remplacante_id_fkey"
            columns: ["facture_remplacante_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_fournisseurs: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          nom: string
          nom_normalise: string
          specialite_id: string | null
          ville: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nom: string
          nom_normalise: string
          specialite_id?: string | null
          ville?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nom?: string
          nom_normalise?: string
          specialite_id?: string | null
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_fournisseurs_specialite_id_fkey"
            columns: ["specialite_id"]
            isOneToOne: false
            referencedRelation: "specialites"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_imports: {
        Row: {
          artisan_id: string
          created_at: string | null
          erreur_message: string | null
          fichier_type: string
          fichier_url: string
          fournisseur_id: string
          id: string
          nb_produits_extraits: number | null
          statut: string
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          erreur_message?: string | null
          fichier_type: string
          fichier_url: string
          fournisseur_id: string
          id?: string
          nb_produits_extraits?: number | null
          statut?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          erreur_message?: string | null
          fichier_type?: string
          fichier_url?: string
          fournisseur_id?: string
          id?: string
          nb_produits_extraits?: number | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_imports_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
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
          description: string | null
          etat_projet: string | null
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
          description?: string | null
          etat_projet?: string | null
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
          description?: string | null
          etat_projet?: string | null
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
          auth_user_id: string | null
          commentaires: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          prenom: string | null
          siret: string | null
          telephone: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          artisan_id: string
          auth_user_id?: string | null
          commentaires?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          prenom?: string | null
          siret?: string | null
          telephone?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          artisan_id?: string
          auth_user_id?: string | null
          commentaires?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string | null
          siret?: string | null
          telephone?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          adresse: string | null
          artisan_id: string
          created_at: string
          email: string | null
          entreprise: string | null
          id: string
          nom: string
          notes: string | null
          prenom: string | null
          role: string | null
          site_web: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          artisan_id: string
          created_at?: string
          email?: string | null
          entreprise?: string | null
          id?: string
          nom: string
          notes?: string | null
          prenom?: string | null
          role?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          artisan_id?: string
          created_at?: string
          email?: string | null
          entreprise?: string | null
          id?: string
          nom?: string
          notes?: string | null
          prenom?: string | null
          role?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      devis: {
        Row: {
          artisan_id: string
          base_numero: string | null
          chantier_id: string | null
          client_id: string | null
          created_at: string
          date_validite: string | null
          email_clique_at: string | null
          email_ouvert_at: string | null
          facturx_ready: boolean
          id: string
          montant_ht: number
          numero: string
          original_pdf_generated_at: string | null
          original_pdf_path: string | null
          parent_devis_id: string | null
          statut: Database["public"]["Enums"]["devis_statut"]
          token_expires_at: string | null
          token_public: string
          tva: number
          updated_at: string
          version: number
        }
        Insert: {
          artisan_id: string
          base_numero?: string | null
          chantier_id?: string | null
          client_id?: string | null
          created_at?: string
          date_validite?: string | null
          email_clique_at?: string | null
          email_ouvert_at?: string | null
          facturx_ready?: boolean
          id?: string
          montant_ht?: number
          numero: string
          original_pdf_generated_at?: string | null
          original_pdf_path?: string | null
          parent_devis_id?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          token_expires_at?: string | null
          token_public?: string
          tva?: number
          updated_at?: string
          version?: number
        }
        Update: {
          artisan_id?: string
          base_numero?: string | null
          chantier_id?: string | null
          client_id?: string | null
          created_at?: string
          date_validite?: string | null
          email_clique_at?: string | null
          email_ouvert_at?: string | null
          facturx_ready?: boolean
          id?: string
          montant_ht?: number
          numero?: string
          original_pdf_generated_at?: string | null
          original_pdf_path?: string | null
          parent_devis_id?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          token_expires_at?: string | null
          token_public?: string
          tva?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_parent_devis_id_fkey"
            columns: ["parent_devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_annotations: {
        Row: {
          contenu: string | null
          created_at: string
          devis_id: string
          id: string
          ligne_id: string | null
          type: string
        }
        Insert: {
          contenu?: string | null
          created_at?: string
          devis_id: string
          id?: string
          ligne_id?: string | null
          type: string
        }
        Update: {
          contenu?: string | null
          created_at?: string
          devis_id?: string
          id?: string
          ligne_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_annotations_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_annotations_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: false
            referencedRelation: "lignes_devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_signatures: {
        Row: {
          bon_pour_accord: string | null
          devis_id: string
          id: string
          ip_address: string | null
          pdf_signed_path: string | null
          signature_data: string
          signed_at: string
        }
        Insert: {
          bon_pour_accord?: string | null
          devis_id: string
          id?: string
          ip_address?: string | null
          pdf_signed_path?: string | null
          signature_data: string
          signed_at?: string
        }
        Update: {
          bon_pour_accord?: string | null
          devis_id?: string
          id?: string
          ip_address?: string | null
          pdf_signed_path?: string | null
          signature_data?: string
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_signatures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      document_counters: {
        Row: {
          annee: number
          artisan_id: string
          dernier_num: number
          doc_type: string
          mois: number
        }
        Insert: {
          annee: number
          artisan_id: string
          dernier_num?: number
          doc_type: string
          mois: number
        }
        Update: {
          annee?: number
          artisan_id?: string
          dernier_num?: number
          doc_type?: string
          mois?: number
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          artisan_id: string
          couleur_accent: string
          couleur_primaire: string
          couleur_secondaire: string
          created_at: string
          css_template: string | null
          entete_texte: string | null
          html_template: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          metadata: Json
          nom: string
          secteur: string
          updated_at: string
        }
        Insert: {
          artisan_id: string
          couleur_accent?: string
          couleur_primaire?: string
          couleur_secondaire?: string
          created_at?: string
          css_template?: string | null
          entete_texte?: string | null
          html_template?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json
          nom?: string
          secteur?: string
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          couleur_accent?: string
          couleur_primaire?: string
          couleur_secondaire?: string
          created_at?: string
          css_template?: string | null
          entete_texte?: string | null
          html_template?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json
          nom?: string
          secteur?: string
          updated_at?: string
        }
        Relationships: []
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
          avoir_annulation_id: string | null
          client_id: string | null
          created_at: string
          date_echeance: string
          devis_id: string
          email_clique_at: string | null
          email_ouvert_at: string | null
          id: string
          montant_ht: number
          montant_ttc: number
          montant_tva: number
          numero: string
          solde_restant: number
          statut: Database["public"]["Enums"]["facture_statut"]
          ts_id: string | null
          tva: number
          type: string
          updated_at: string
        }
        Insert: {
          artisan_id: string
          avoir_annulation_id?: string | null
          client_id?: string | null
          created_at?: string
          date_echeance: string
          devis_id: string
          email_clique_at?: string | null
          email_ouvert_at?: string | null
          id?: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          numero: string
          solde_restant?: number
          statut?: Database["public"]["Enums"]["facture_statut"]
          ts_id?: string | null
          tva?: number
          type?: string
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          avoir_annulation_id?: string | null
          client_id?: string | null
          created_at?: string
          date_echeance?: string
          devis_id?: string
          email_clique_at?: string | null
          email_ouvert_at?: string | null
          id?: string
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          numero?: string
          solde_restant?: number
          statut?: Database["public"]["Enums"]["facture_statut"]
          ts_id?: string | null
          tva?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_avoir_annulation_id_fkey"
            columns: ["avoir_annulation_id"]
            isOneToOne: false
            referencedRelation: "avoirs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_ts_id_fkey"
            columns: ["ts_id"]
            isOneToOne: false
            referencedRelation: "travaux_supplementaires"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          adresse: string | null
          api_config_id: string | null
          artisan_id: string
          catalogue_fournisseur_id: string | null
          categorie: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          nom_contact: string | null
          notes: string | null
          siret: string | null
          telephone: string | null
          updated_at: string
          ville: string
        }
        Insert: {
          adresse?: string | null
          api_config_id?: string | null
          artisan_id: string
          catalogue_fournisseur_id?: string | null
          categorie?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          nom_contact?: string | null
          notes?: string | null
          siret?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string
        }
        Update: {
          adresse?: string | null
          api_config_id?: string | null
          artisan_id?: string
          catalogue_fournisseur_id?: string | null
          categorie?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          nom_contact?: string | null
          notes?: string | null
          siret?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fournisseurs_catalogue_fournisseur_id_fkey"
            columns: ["catalogue_fournisseur_id"]
            isOneToOne: false
            referencedRelation: "catalogue_fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          artisan_id: string
          contenu: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          is_global: boolean
          metadata: Json
        }
        Insert: {
          artisan_id: string
          contenu: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          is_global?: boolean
          metadata?: Json
        }
        Update: {
          artisan_id?: string
          contenu?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          is_global?: boolean
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          artisan_id: string
          created_at: string
          id: string
          is_global: boolean
          nom: string
          statut: string
          storage_path: string | null
          type_fichier: string
        }
        Insert: {
          artisan_id: string
          created_at?: string
          id?: string
          is_global?: boolean
          nom: string
          statut?: string
          storage_path?: string | null
          type_fichier: string
        }
        Update: {
          artisan_id?: string
          created_at?: string
          id?: string
          is_global?: boolean
          nom?: string
          statut?: string
          storage_path?: string | null
          type_fichier?: string
        }
        Relationships: []
      }
      lignes_avenant: {
        Row: {
          artisan_id: string
          avenant_id: string
          created_at: string | null
          designation: string
          id: string
          ordre: number
          prix_unitaire: number
          quantite: number
          section_nom: string | null
          tva: number
          unite: string
        }
        Insert: {
          artisan_id: string
          avenant_id: string
          created_at?: string | null
          designation?: string
          id?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          section_nom?: string | null
          tva?: number
          unite?: string
        }
        Update: {
          artisan_id?: string
          avenant_id?: string
          created_at?: string | null
          designation?: string
          id?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          section_nom?: string | null
          tva?: number
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "lignes_avenant_avenant_id_fkey"
            columns: ["avenant_id"]
            isOneToOne: false
            referencedRelation: "avenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_avoir: {
        Row: {
          artisan_id: string
          avoir_id: string
          created_at: string
          designation: string
          id: string
          ordre: number
          prix_unitaire: number
          quantite: number
          tva: number
          unite: string
        }
        Insert: {
          artisan_id: string
          avoir_id: string
          created_at?: string
          designation?: string
          id?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          unite?: string
        }
        Update: {
          artisan_id?: string
          avoir_id?: string
          created_at?: string
          designation?: string
          id?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "lignes_avoir_avoir_id_fkey"
            columns: ["avoir_id"]
            isOneToOne: false
            referencedRelation: "avoirs"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_devis: {
        Row: {
          artisan_id: string
          created_at: string | null
          designation: string
          devis_id: string
          fournisseur_id: string | null
          id: string
          marge_pct: number | null
          ordre: number
          prix_achat: number | null
          prix_unitaire: number
          produit_id: string | null
          quantite: number
          section_nom: string | null
          tva: number
          unite: string
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          designation?: string
          devis_id: string
          fournisseur_id?: string | null
          id?: string
          marge_pct?: number | null
          ordre?: number
          prix_achat?: number | null
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          section_nom?: string | null
          tva?: number
          unite?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          designation?: string
          devis_id?: string
          fournisseur_id?: string | null
          id?: string
          marge_pct?: number | null
          ordre?: number
          prix_achat?: number | null
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          section_nom?: string | null
          tva?: number
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "lignes_devis_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_devis_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_devis_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_facture: {
        Row: {
          artisan_id: string
          created_at: string | null
          designation: string
          facture_id: string
          fournisseur_id: string | null
          id: string
          marge_pct: number | null
          ordre: number
          prix_achat: number | null
          prix_unitaire: number
          produit_id: string | null
          quantite: number
          tva: number
          unite: string
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          designation?: string
          facture_id: string
          fournisseur_id?: string | null
          id?: string
          marge_pct?: number | null
          ordre?: number
          prix_achat?: number | null
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          tva?: number
          unite?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          designation?: string
          facture_id?: string
          fournisseur_id?: string | null
          id?: string
          marge_pct?: number | null
          ordre?: number
          prix_achat?: number | null
          prix_unitaire?: number
          produit_id?: string | null
          quantite?: number
          tva?: number
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "lignes_facture_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_facture_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_facture_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_ts: {
        Row: {
          artisan_id: string
          created_at: string | null
          designation: string
          id: string
          ordre: number
          prix_unitaire: number
          quantite: number
          section_nom: string | null
          ts_id: string
          tva: number
          unite: string
        }
        Insert: {
          artisan_id: string
          created_at?: string | null
          designation?: string
          id?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          section_nom?: string | null
          ts_id: string
          tva?: number
          unite?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string | null
          designation?: string
          id?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          section_nom?: string | null
          ts_id?: string
          tva?: number
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "lignes_ts_ts_id_fkey"
            columns: ["ts_id"]
            isOneToOne: false
            referencedRelation: "travaux_supplementaires"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          annotations_data: Json | null
          artisan_id: string
          body: string
          direction: string
          document_id: string | null
          document_type: string | null
          from_client_name: string | null
          id: string
          read: boolean
          sent_at: string
          status: string
          subject: string
          to_email: string
          to_name: string | null
        }
        Insert: {
          annotations_data?: Json | null
          artisan_id: string
          body: string
          direction?: string
          document_id?: string | null
          document_type?: string | null
          from_client_name?: string | null
          id?: string
          read?: boolean
          sent_at?: string
          status?: string
          subject: string
          to_email: string
          to_name?: string | null
        }
        Update: {
          annotations_data?: Json | null
          artisan_id?: string
          body?: string
          direction?: string
          document_id?: string | null
          document_type?: string | null
          from_client_name?: string | null
          id?: string
          read?: boolean
          sent_at?: string
          status?: string
          subject?: string
          to_email?: string
          to_name?: string | null
        }
        Relationships: []
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
      produits: {
        Row: {
          actif: boolean
          artisan_id: string | null
          created_at: string | null
          designation: string
          fournisseur_id: string
          id: string
          image_url: string | null
          import_id: string | null
          page_catalogue: number | null
          prix_achat: number
          reference: string | null
          statut_import: string
          unite: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean
          artisan_id?: string | null
          created_at?: string | null
          designation?: string
          fournisseur_id: string
          id?: string
          image_url?: string | null
          import_id?: string | null
          page_catalogue?: number | null
          prix_achat?: number
          reference?: string | null
          statut_import?: string
          unite?: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean
          artisan_id?: string | null
          created_at?: string | null
          designation?: string
          fournisseur_id?: string
          id?: string
          image_url?: string | null
          import_id?: string | null
          page_catalogue?: number | null
          prix_achat?: number
          reference?: string | null
          statut_import?: string
          unite?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "catalogue_fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "catalogue_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          activite: string | null
          adresse: string | null
          code_postal: string | null
          created_at: string
          forme_juridique: string | null
          id: string
          kbis_deadline: string | null
          kbis_uploaded_at: string | null
          kbis_url: string | null
          logo_url: string | null
          nom: string
          nom_commercial: string | null
          pays: string | null
          plan_abonnement: Database["public"]["Enums"]["plan_abonnement"]
          prenom: string
          profile_completed: boolean
          raison_sociale: string | null
          siret: string | null
          telephone: string | null
          tva_intracommunautaire: string | null
          updated_at: string
          user_id: string
          ville: string | null
        }
        Insert: {
          account_type?: string
          activite?: string | null
          adresse?: string | null
          code_postal?: string | null
          created_at?: string
          forme_juridique?: string | null
          id?: string
          kbis_deadline?: string | null
          kbis_uploaded_at?: string | null
          kbis_url?: string | null
          logo_url?: string | null
          nom?: string
          nom_commercial?: string | null
          pays?: string | null
          plan_abonnement?: Database["public"]["Enums"]["plan_abonnement"]
          prenom?: string
          profile_completed?: boolean
          raison_sociale?: string | null
          siret?: string | null
          telephone?: string | null
          tva_intracommunautaire?: string | null
          updated_at?: string
          user_id: string
          ville?: string | null
        }
        Update: {
          account_type?: string
          activite?: string | null
          adresse?: string | null
          code_postal?: string | null
          created_at?: string
          forme_juridique?: string | null
          id?: string
          kbis_deadline?: string | null
          kbis_uploaded_at?: string | null
          kbis_url?: string | null
          logo_url?: string | null
          nom?: string
          nom_commercial?: string | null
          pays?: string | null
          plan_abonnement?: Database["public"]["Enums"]["plan_abonnement"]
          prenom?: string
          profile_completed?: boolean
          raison_sociale?: string | null
          siret?: string | null
          telephone?: string | null
          tva_intracommunautaire?: string | null
          updated_at?: string
          user_id?: string
          ville?: string | null
        }
        Relationships: []
      }
      specialites: {
        Row: {
          id: string
          nom: string
        }
        Insert: {
          id?: string
          nom: string
        }
        Update: {
          id?: string
          nom?: string
        }
        Relationships: []
      }
      template_elements: {
        Row: {
          created_at: string
          id: string
          template_id: string
          type: string
          valeur: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          template_id: string
          type: string
          valeur?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          template_id?: string
          type?: string
          valeur?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_elements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          created_at: string
          description: string | null
          etapes: string | null
          fonctionnalite: string
          id: string
          priorite: string
          reference: string
          resultat_attendu: string | null
          resultat_obtenu: string | null
          statut: string
          tester_id: string
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          etapes?: string | null
          fonctionnalite: string
          id?: string
          priorite?: string
          reference: string
          resultat_attendu?: string | null
          resultat_obtenu?: string | null
          statut?: string
          tester_id: string
          titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          etapes?: string | null
          fonctionnalite?: string
          id?: string
          priorite?: string
          reference?: string
          resultat_attendu?: string | null
          resultat_obtenu?: string | null
          statut?: string
          tester_id?: string
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_defects: {
        Row: {
          created_at: string
          description: string | null
          environnement: string | null
          etapes_reproduction: string | null
          fonctionnalite: string
          id: string
          reference: string
          severite: string
          statut: string
          test_case_id: string | null
          tester_id: string
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          environnement?: string | null
          etapes_reproduction?: string | null
          fonctionnalite: string
          id?: string
          reference: string
          severite?: string
          statut?: string
          test_case_id?: string | null
          tester_id: string
          titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          environnement?: string | null
          etapes_reproduction?: string | null
          fonctionnalite?: string
          id?: string
          reference?: string
          severite?: string
          statut?: string
          test_case_id?: string | null
          tester_id?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_defects_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      travaux_supplementaires: {
        Row: {
          artisan_id: string
          chantier_id: string | null
          client_id: string | null
          created_at: string | null
          date: string
          date_validite: string | null
          description: string
          devis_id: string
          id: string
          montant_ht: number
          numero: string
          original_pdf_generated_at: string | null
          original_pdf_path: string | null
          statut: Database["public"]["Enums"]["devis_statut"]
          token_expires_at: string | null
          token_public: string
          tva: number
          updated_at: string | null
        }
        Insert: {
          artisan_id: string
          chantier_id?: string | null
          client_id?: string | null
          created_at?: string | null
          date?: string
          date_validite?: string | null
          description?: string
          devis_id: string
          id?: string
          montant_ht?: number
          numero: string
          original_pdf_generated_at?: string | null
          original_pdf_path?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          token_expires_at?: string | null
          token_public?: string
          tva?: number
          updated_at?: string | null
        }
        Update: {
          artisan_id?: string
          chantier_id?: string | null
          client_id?: string | null
          created_at?: string | null
          date?: string
          date_validite?: string | null
          description?: string
          devis_id?: string
          id?: string
          montant_ht?: number
          numero?: string
          original_pdf_generated_at?: string | null
          original_pdf_path?: string | null
          statut?: Database["public"]["Enums"]["devis_statut"]
          token_expires_at?: string | null
          token_public?: string
          tva?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travaux_supplementaires_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travaux_supplementaires_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travaux_supplementaires_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
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
      check_siret_available: { Args: { p_siret: string }; Returns: boolean }
      get_user_email: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_doc_number: {
        Args: {
          p_annee: number
          p_artisan_id: string
          p_doc_type: string
          p_mois: number
        }
        Returns: number
      }
      search_all_tables: {
        Args: { search: string }
        Returns: {
          column_name: string
          nb: number
          table_name: string
        }[]
      }
      search_knowledge_chunks:
        | {
            Args: {
              p_artisan_id: string
              p_embedding: string
              p_limit?: number
            }
            Returns: {
              artisan_id: string
              contenu: string
              document_id: string
              id: string
              metadata: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              p_artisan_id: string
              p_embedding: string
              p_limit?: number
            }
            Returns: {
              contenu: string
              document_id: string
              id: string
              metadata: Json
              similarity: number
            }[]
          }
    }
    Enums: {
      app_role: "admin" | "artisan" | "super_admin" | "tester" | "client"
      automation_statut: "pending" | "approved" | "sent"
      chantier_statut: "prospect" | "en_cours" | "termine" | "litige"
      client_type: "particulier" | "pro"
      devis_statut:
        | "brouillon"
        | "envoye"
        | "signe"
        | "refuse"
        | "en_cours"
        | "chantier_en_cours"
        | "termine"
        | "remplace"
        | "facture"
      facture_statut:
        | "brouillon"
        | "envoyee"
        | "payee"
        | "impayee"
        | "en_attente_paiement"
        | "refusee"
        | "a_modifier"
        | "annulee"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "artisan", "super_admin", "tester", "client"],
      automation_statut: ["pending", "approved", "sent"],
      chantier_statut: ["prospect", "en_cours", "termine", "litige"],
      client_type: ["particulier", "pro"],
      devis_statut: [
        "brouillon",
        "envoye",
        "signe",
        "refuse",
        "en_cours",
        "chantier_en_cours",
        "termine",
        "remplace",
        "facture",
      ],
      facture_statut: [
        "brouillon",
        "envoyee",
        "payee",
        "impayee",
        "en_attente_paiement",
        "refusee",
        "a_modifier",
        "annulee",
      ],
      plan_abonnement: ["gratuit", "starter", "pro", "enterprise"],
    },
  },
} as const
