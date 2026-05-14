import { useEffect, useState, useRef, Fragment } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check, X, MessageSquare, Edit3, CreditCard, RotateCcw, Strikethrough, CircleDot } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function fmt(n: number) {
  return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

interface Ligne {
  id: string;
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  tva: number;
  section_nom: string | null;
  ordre: number;
}
interface LineAnn { strikethrough?: boolean; circled?: boolean; comment?: string }

export default function DevisPublic() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [annotateMode, setAnnotateMode] = useState(false);
  const [lineAnns, setLineAnns] = useState<Record<string, LineAnn>>({});
  const [globalComment, setGlobalComment] = useState("");
  const [savingAnns, setSavingAnns] = useState(false);

  const [refusalOpen, setRefusalOpen] = useState(false);
  const [refusalComment, setRefusalComment] = useState("");
  const [refusing, setRefusing] = useState(false);

  const [signOpen, setSignOpen] = useState(false);
  const [bonPourAccord, setBonPourAccord] = useState("Bon pour accord");
  const [signing, setSigning] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [finalStatus, setFinalStatus] = useState<"signe" | "refuse" | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (!token) { setErr("Lien invalide"); setLoading(false); return; }
    fetch(`${SUPABASE_URL}/functions/v1/devis-public?token=${token}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); }
        else {
          setData(d);
          if (d.devis.statut === "signe") setFinalStatus("signe");
          if (d.devis.statut === "refuse") setFinalStatus("refuse");
        }
      })
      .catch(() => setErr("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [token]);

  // Initialisation du canvas à l'ouverture du dialog de signature
  useEffect(() => {
    if (!signOpen) return;
    const t = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.getContext("2d")!.scale(dpr, dpr);
    }, 80);
    return () => clearTimeout(t);
  }, [signOpen]);

  function getPoint(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    isDrawing.current = true;
    const canvas = canvasRef.current!;
    const pt = getPoint(e, canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const pt = getPoint(e, canvas);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }
  function stopDraw() { isDrawing.current = false; }
  function clearCanvas() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }
  function isCanvasEmpty() {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    return !canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some(b => b !== 0);
  }

  function toggleAnn(lineId: string, key: keyof LineAnn) {
    setLineAnns(prev => {
      const cur = prev[lineId] ?? {};
      return { ...prev, [lineId]: { ...cur, [key]: !cur[key] } };
    });
  }
  function setLineComment(lineId: string, text: string) {
    setLineAnns(prev => ({ ...prev, [lineId]: { ...(prev[lineId] ?? {}), comment: text } }));
  }

  async function callPublic(body: Record<string, unknown>) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/devis-public`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ token, ...body }),
    });
    return r.json();
  }

  async function handleSaveAnnotations() {
    setSavingAnns(true);
    const annotations: Array<{ type: string; ligne_id?: string; contenu?: string }> = [];
    Object.entries(lineAnns).forEach(([lid, ann]) => {
      if (ann.strikethrough) annotations.push({ type: "line_strikethrough", ligne_id: lid });
      if (ann.circled) annotations.push({ type: "line_circled", ligne_id: lid });
      if (ann.comment?.trim()) annotations.push({ type: "line_comment", ligne_id: lid, contenu: ann.comment.trim() });
    });
    if (globalComment.trim()) annotations.push({ type: "global_comment", contenu: globalComment.trim() });
    try {
      const d = await callPublic({ action: "annotate", annotations });
      if (d.ok) { toast.success("Annotations envoyées à l'artisan"); setAnnotateMode(false); }
      else toast.error("Erreur lors de l'envoi");
    } catch { toast.error("Erreur réseau"); }
    finally { setSavingAnns(false); }
  }

  async function handleRefuse() {
    setRefusing(true);
    try {
      const d = await callPublic({ action: "refuse", comment: refusalComment });
      if (d.ok) {
        setFinalStatus("refuse");
        setRefusalOpen(false);
        toast.success("Devis refusé — l'artisan a été notifié");
      } else toast.error("Erreur");
    } catch { toast.error("Erreur réseau"); }
    finally { setRefusing(false); }
  }

  async function handleSign() {
    if (isCanvasEmpty()) { toast.error("Veuillez apposer votre signature avant de valider"); return; }
    setSigning(true);
    const signatureData = canvasRef.current!.toDataURL("image/png");
    try {
      const d = await callPublic({ action: "sign", signature_data: signatureData, bon_pour_accord: bonPourAccord });
      if (d.ok) {
        setFinalStatus("signe");
        setSignOpen(false);
        setPaymentOpen(true);
      } else toast.error("Erreur lors de la signature");
    } catch { toast.error("Erreur réseau"); }
    finally { setSigning(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-2">
          <p className="text-2xl">🔍</p>
          <p className="font-semibold text-gray-700">Devis introuvable</p>
          <p className="text-sm text-gray-500">{err ?? "Ce lien est invalide ou expiré."}</p>
        </div>
      </div>
    );
  }

  const { devis, artisan, client, chantier, lignes } = data;
  const montantTTC = Number(devis.montant_ht) * (1 + Number(devis.tva) / 100);
  const montantTVA = Number(devis.montant_ht) * (Number(devis.tva) / 100);
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  let currentSection: string | null = null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Bandeau annotation mode */}
      {annotateMode && (
        <div className="sticky top-0 z-30 bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between text-sm font-medium shadow">
          <span>Mode annotation actif — Sélectionnez les modifications souhaitées</span>
          <button onClick={() => setAnnotateMode(false)} className="hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Document */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* En-tête */}
          <div className="px-6 pt-6 pb-5 border-b border-gray-100 flex justify-between items-start gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-0.5">
                {[artisan.prenom, artisan.nom].filter(Boolean).join(" ")}
              </p>
              {artisan.adresse && <p className="text-xs text-gray-500">{artisan.adresse}{artisan.code_postal ? `, ${artisan.code_postal}` : ""}{artisan.ville ? ` ${artisan.ville}` : ""}</p>}
              {artisan.siret && <p className="text-xs text-gray-500">SIRET : {artisan.siret}</p>}
              {artisan.telephone && <p className="text-xs text-gray-500">Tél. {artisan.telephone}</p>}
              {artisan.email && <p className="text-xs text-gray-500">{artisan.email}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-blue-700 uppercase">Devis</p>
              <p className="text-sm font-semibold mt-0.5">N° {devis.numero}</p>
              <p className="text-xs text-gray-500">Date : {fmtDate(devis.created_at)}</p>
              {devis.date_validite && <p className="text-xs text-gray-500">Validité : {fmtDate(devis.date_validite)}</p>}
              <span className={`mt-1.5 inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                devis.statut === "signe" ? "bg-green-100 text-green-700" :
                devis.statut === "refuse" ? "bg-red-100 text-red-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {devis.statut === "signe" ? "Signé" : devis.statut === "refuse" ? "Refusé" : "En attente"}
              </span>
            </div>
          </div>

          {/* Client */}
          {client && (
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Client</p>
              <p className="text-sm font-medium text-gray-800">
                {[client.prenom, client.nom].filter(Boolean).join(" ")}
              </p>
              {client.adresse && <p className="text-xs text-gray-500">{client.adresse}</p>}
              {chantier?.nom && <p className="text-xs text-gray-500 mt-0.5">Chantier : {chantier.nom}{chantier.adresse_chantier ? ` — ${chantier.adresse_chantier}` : ""}</p>}
            </div>
          )}

          {/* Tableau des lignes */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-700 text-white text-xs">
                  <th className="text-left px-4 py-2.5 font-semibold">Description</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-24">Qté</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-24">P.U. HT</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-28">Total HT</th>
                  {annotateMode && <th className="w-24" />}
                </tr>
              </thead>
              <tbody>
                {(lignes as Ligne[]).map((l, i) => {
                  const isNewSection = l.section_nom && l.section_nom !== currentSection;
                  if (isNewSection) currentSection = l.section_nom;
                  const ann = lineAnns[l.id] ?? {};
                  const total = Number(l.quantite) * Number(l.prix_unitaire);
                  return (
                    <Fragment key={l.id}>
                      {isNewSection && (
                        <tr key={`sec-${l.id}`} className="bg-blue-50 border-t border-blue-100">
                          <td colSpan={annotateMode ? 5 : 4} className="px-4 py-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
                            {l.section_nom}
                          </td>
                        </tr>
                      )}
                      <tr
                        key={l.id}
                        className={`border-b border-gray-100 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"} ${ann.circled ? "ring-2 ring-inset ring-orange-400 bg-orange-50/40" : ""}`}
                      >
                        <td className={`px-4 py-2.5 ${ann.strikethrough ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {l.designation}
                          {ann.comment && !annotateMode && (
                            <p className="mt-1 text-xs text-orange-600 italic">{ann.comment}</p>
                          )}
                          {annotateMode && (
                            <Input
                              value={ann.comment ?? ""}
                              onChange={e => setLineComment(l.id, e.target.value)}
                              placeholder="Commentaire sur cette ligne…"
                              className="mt-1.5 text-xs h-7 border-orange-200 focus:border-orange-400"
                            />
                          )}
                        </td>
                        <td className="text-right px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {l.quantite} {l.unite}
                        </td>
                        <td className="text-right px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {fmt(Number(l.prix_unitaire))}
                        </td>
                        <td className="text-right px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">
                          {fmt(total)}
                        </td>
                        {annotateMode && (
                          <td className="px-2 py-2.5">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => toggleAnn(l.id, "strikethrough")}
                                title="Rayer"
                                className={`p-1 rounded transition-colors ${ann.strikethrough ? "bg-red-100 text-red-600" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
                              >
                                <Strikethrough className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => toggleAnn(l.id, "circled")}
                                title="Entourer"
                                className={`p-1 rounded transition-colors ${ann.circled ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"}`}
                              >
                                <CircleDot className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  );
                })}
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={annotateMode ? 5 : 4} className="px-4 py-8 text-center text-gray-400 italic text-sm">
                      Aucune prestation renseignée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total HT</span>
                <span>{fmt(Number(devis.montant_ht))}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>TVA ({devis.tva} %)</span>
                <span>{fmt(montantTVA)}</span>
              </div>
              <div className="flex justify-between font-bold text-base bg-blue-700 text-white px-3 py-2 rounded-lg mt-1">
                <span>Net à payer TTC</span>
                <span>{fmt(montantTTC)}</span>
              </div>
            </div>
          </div>

          {/* Commentaire global en mode annotation */}
          {annotateMode && (
            <div className="px-6 py-4 border-t border-blue-100 bg-blue-50/40">
              <Label className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Commentaire général</Label>
              <Textarea
                value={globalComment}
                onChange={e => setGlobalComment(e.target.value)}
                placeholder="Ajoutez un commentaire global sur ce devis…"
                rows={3}
                className="mt-1.5 text-sm border-blue-200 focus:border-blue-400"
              />
              <div className="flex gap-2 mt-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => setAnnotateMode(false)} className="text-xs">
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSaveAnnotations} disabled={savingAnns} className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  {savingAnns ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Envoyer mes annotations
                </Button>
              </div>
            </div>
          )}

          {/* Mentions légales */}
          <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-400 italic leading-relaxed">
            * Assurance Décennale souscrite — attestation disponible sur demande.<br />
            * Règlement à réception de facture. Tout retard entraîne des pénalités de 3× le taux d'intérêt légal.<br />
            * En cas de retard de paiement, une indemnité forfaitaire de 40 € sera appliquée.
          </div>
        </div>

        {/* Statut final */}
        {finalStatus === "signe" && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">Devis signé et validé — merci ! L'artisan a été notifié.</p>
          </div>
        )}
        {finalStatus === "refuse" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <X className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 font-medium">Devis refusé — l'artisan a été notifié.</p>
          </div>
        )}

        {/* Boutons d'action */}
        {!finalStatus && (
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => setAnnotateMode(v => !v)}
              className={`flex flex-col items-center gap-1.5 h-auto py-3 text-xs border-2 transition-all ${annotateMode ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`}
            >
              <Edit3 className="w-5 h-5" />
              Annoter le devis
            </Button>
            <Button
              variant="outline"
              onClick={() => setRefusalOpen(true)}
              className="flex flex-col items-center gap-1.5 h-auto py-3 text-xs border-2 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <X className="w-5 h-5" />
              Refuser ce devis
            </Button>
            <Button
              onClick={() => setSignOpen(true)}
              className="flex flex-col items-center gap-1.5 h-auto py-3 text-xs bg-green-600 hover:bg-green-700 text-white border-2 border-transparent transition-all"
            >
              <Check className="w-5 h-5" />
              Valider ce devis
            </Button>
          </div>
        )}
      </div>

      {/* Dialog : Refus */}
      <Dialog open={refusalOpen} onOpenChange={v => { if (!v) setRefusalOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="w-4 h-4" /> Refuser ce devis
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm text-gray-600">Laissez un commentaire expliquant votre refus</Label>
            <Textarea
              value={refusalComment}
              onChange={e => setRefusalComment(e.target.value)}
              placeholder="Ex : Prix trop élevé, prestations non adaptées…"
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefusalOpen(false)} disabled={refusing}>Annuler</Button>
            <Button onClick={handleRefuse} disabled={refusing} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              {refusing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Signature */}
      <Dialog open={signOpen} onOpenChange={v => { if (!v) setSignOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Check className="w-4 h-4" /> Valider et signer le devis
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bon pour accord</Label>
              <Input
                value={bonPourAccord}
                onChange={e => setBonPourAccord(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Votre signature</Label>
                <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Effacer
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="w-full h-36 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 touch-none cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              <p className="text-xs text-gray-400 text-center">Signez dans le cadre ci-dessus</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 flex justify-between">
              <span>Date de signature</span>
              <span className="font-medium text-gray-700">{today}</span>
            </div>
            <p className="text-xs text-gray-400 italic">
              En validant, vous acceptez les conditions du devis {data?.devis.numero} d'un montant de {fmt(montantTTC)} TTC.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)} disabled={signing}>Annuler</Button>
            <Button onClick={handleSign} disabled={signing} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Signer et valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Paiement */}
      <Dialog open={paymentOpen} onOpenChange={v => { if (!v) setPaymentOpen(false); }}>
        <DialogContent className="max-w-md text-center">
          <div className="py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CreditCard className="w-7 h-7 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-green-700">Devis signé avec succès !</DialogTitle>
            </DialogHeader>
            <p className="text-2xl font-bold text-gray-800">{fmt(montantTTC)} TTC</p>
            <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-700">
              <p className="font-medium">Votre devis a bien été enregistré.</p>
              <p className="mt-1 text-green-600">L'artisan vous contactera prochainement pour les modalités de règlement.</p>
            </div>
            <p className="text-xs text-gray-400">
              Un récapitulatif vous sera transmis par email.
            </p>
          </div>
          <DialogFooter className="justify-center">
            <Button onClick={() => setPaymentOpen(false)} className="bg-green-600 hover:bg-green-700 text-white px-8">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
