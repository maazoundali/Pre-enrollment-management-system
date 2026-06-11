-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ETUDIANT', 'ADMINISTRATEUR', 'SUPERVISEUR');

-- CreateEnum
CREATE TYPE "Statut" AS ENUM ('BROUILLON', 'SOUMIS', 'EN_ANALYSE', 'VALIDE', 'REJETE', 'LISTE_ATTENTE');

-- CreateEnum
CREATE TYPE "TypeNotif" AS ENUM ('DOSSIER_INCOMPLET', 'RECOMMANDATION', 'DECISION_ADMIN', 'STATUT_MAJ', 'DOSSIER_MAJ');

-- CreateEnum
CREATE TYPE "TypeDoc" AS ENUM ('CNI', 'PASSEPORT', 'DIPLOME', 'RELEVE_NOTES', 'PHOTO', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeIdentite" AS ENUM ('CIN', 'PASSEPORT');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('HOMME', 'FEMME', 'AUTRE');

-- CreateEnum
CREATE TYPE "SourceDecouverte" AS ENUM ('AMIS', 'RESEAUX_SOCIAUX', 'SITE_WEB', 'PUBLICITE', 'SALON_ETUDIANT', 'AUTRE');

-- CreateEnum
CREATE TYPE "NiveauEtude" AS ENUM ('BACCALAUREAT', 'LICENCE_1', 'LICENCE_2', 'LICENCE_3', 'MASTER_1', 'MASTER_2', 'DOCTORAT', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeCours" AS ENUM ('COURS_JOUR', 'COURS_SOIR', 'FORMATION_CONTINUE');

-- CreateEnum
CREATE TYPE "VerificationDoc" AS ENUM ('VERIFIED', 'REJECTED', 'NEEDS_REUPLOAD');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nom" TEXT,
    "prenom" TEXT,
    "dateNaissance" TIMESTAMP(3),
    "typeIdentite" "TypeIdentite",
    "numeroIdentite" TEXT,
    "sexe" "Sexe",
    "adresse" TEXT,
    "pays" TEXT,
    "telephone" TEXT,
    "departement" TEXT,
    "niveauAcces" INTEGER,
    "consentementRGPD" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filieres" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "capacite" INTEGER NOT NULL,
    "description" TEXT,
    "programme" TEXT,
    "duree" TEXT,
    "diplomeDelivre" TEXT,
    "langue" TEXT,
    "fraisInscription" DOUBLE PRECISION,
    "categorie" TEXT,

    CONSTRAINT "filieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_filieres" (
    "administrateurId" TEXT NOT NULL,
    "filiereId" TEXT NOT NULL,

    CONSTRAINT "admin_filieres_pkey" PRIMARY KEY ("administrateurId","filiereId")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMaj" TIMESTAMP(3) NOT NULL,
    "statut" "Statut" NOT NULL DEFAULT 'BROUILLON',
    "score" DOUBLE PRECISION,
    "etudiantId" TEXT NOT NULL,
    "filiereId" TEXT,
    "dernierDiplome" TEXT,
    "anneeDiplome" INTEGER,
    "diplomeVise" TEXT,
    "niveauEtude" "NiveauEtude",
    "typeCours" "TypeCours",
    "sourceDecouverte" "SourceDecouverte",
    "notes" JSONB,
    "motifRejet" TEXT,
    "rangListeAttente" INTEGER,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "TypeDoc" NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "dateUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification" "VerificationDoc",
    "verificationNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "dossierId" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "TypeNotif" NOT NULL,
    "message" TEXT NOT NULL,
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "destinataireId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "dateAnalyse" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION NOT NULL,
    "resultat" TEXT NOT NULL,
    "complet" BOOLEAN NOT NULL,
    "dossierId" TEXT NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyse_filieres" (
    "analyseId" TEXT NOT NULL,
    "filiereId" TEXT NOT NULL,
    "rang" INTEGER NOT NULL,

    CONSTRAINT "analyse_filieres_pkey" PRIMARY KEY ("analyseId","filiereId")
);

-- CreateTable
CREATE TABLE "notes_internes" (
    "id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,

    CONSTRAINT "notes_internes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diplomes" (
    "id" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "etablissement" TEXT,
    "type" TEXT,
    "sousType" TEXT,
    "champs" JSONB,
    "dossierId" TEXT NOT NULL,

    CONSTRAINT "diplomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres_systeme" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "parametres_systeme_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "rapports" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contenu" JSONB NOT NULL,
    "superviseurId" TEXT NOT NULL,

    CONSTRAINT "rapports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_numeroIdentite_key" ON "utilisateurs"("numeroIdentite");

-- CreateIndex
CREATE INDEX "utilisateurs_email_idx" ON "utilisateurs"("email");

-- CreateIndex
CREATE INDEX "utilisateurs_role_idx" ON "utilisateurs"("role");

-- CreateIndex
CREATE INDEX "utilisateurs_numeroIdentite_idx" ON "utilisateurs"("numeroIdentite");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "filieres_nom_key" ON "filieres"("nom");

-- CreateIndex
CREATE INDEX "filieres_nom_idx" ON "filieres"("nom");

-- CreateIndex
CREATE INDEX "dossiers_etudiantId_idx" ON "dossiers"("etudiantId");

-- CreateIndex
CREATE INDEX "dossiers_statut_idx" ON "dossiers"("statut");

-- CreateIndex
CREATE INDEX "dossiers_filiereId_idx" ON "dossiers"("filiereId");

-- CreateIndex
CREATE INDEX "dossiers_statut_filiereId_idx" ON "dossiers"("statut", "filiereId");

-- CreateIndex
CREATE INDEX "dossiers_niveauEtude_idx" ON "dossiers"("niveauEtude");

-- CreateIndex
CREATE INDEX "dossiers_typeCours_idx" ON "dossiers"("typeCours");

-- CreateIndex
CREATE INDEX "documents_dossierId_idx" ON "documents"("dossierId");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "notifications_destinataireId_idx" ON "notifications"("destinataireId");

-- CreateIndex
CREATE INDEX "notifications_destinataireId_lu_idx" ON "notifications"("destinataireId", "lu");

-- CreateIndex
CREATE INDEX "analyses_dossierId_idx" ON "analyses"("dossierId");

-- CreateIndex
CREATE INDEX "notes_internes_dossierId_idx" ON "notes_internes"("dossierId");

-- CreateIndex
CREATE INDEX "diplomes_dossierId_idx" ON "diplomes"("dossierId");

-- CreateIndex
CREATE INDEX "audit_logs_dossierId_idx" ON "audit_logs"("dossierId");

-- CreateIndex
CREATE INDEX "audit_logs_auteurId_idx" ON "audit_logs"("auteurId");

-- CreateIndex
CREATE INDEX "audit_logs_dateAction_idx" ON "audit_logs"("dateAction");

-- CreateIndex
CREATE INDEX "rapports_superviseurId_idx" ON "rapports"("superviseurId");

-- CreateIndex
CREATE INDEX "rapports_dateGeneration_idx" ON "rapports"("dateGeneration");

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_filieres" ADD CONSTRAINT "admin_filieres_administrateurId_fkey" FOREIGN KEY ("administrateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_filieres" ADD CONSTRAINT "admin_filieres_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "filieres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "filieres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyse_filieres" ADD CONSTRAINT "analyse_filieres_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyse_filieres" ADD CONSTRAINT "analyse_filieres_filiereId_fkey" FOREIGN KEY ("filiereId") REFERENCES "filieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_internes" ADD CONSTRAINT "notes_internes_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_internes" ADD CONSTRAINT "notes_internes_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomes" ADD CONSTRAINT "diplomes_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports" ADD CONSTRAINT "rapports_superviseurId_fkey" FOREIGN KEY ("superviseurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
