-- Exemples de pilotage du bureau pour l'espace « Association Démo » (slug demo-review),
-- utilisé pour les captures des stores et par les relecteurs d'Apple et de Google.
-- Dates relatives au jour où le script est lancé. Remplace les actions existantes de cet espace.

do $$
declare
  t uuid := (select id from public.tenants where slug = 'demo-review');
  moi uuid := (select id from public.profiles where tenant_id = t and role in ('admin', 'bureau') order by role limit 1);
  a bigint;
begin
  if t is null then raise exception 'Espace demo-review introuvable'; end if;
  delete from public.actions where tenant_id = t; -- les tâches suivent (cascade)

  insert into public.actions (tenant_id, emoji, titre, date_action, referent, statut, budget)
  values (t, '🎄', 'Marché de Noël', current_date + 24, moi, 'En cours', 1500) returning id into a;
  insert into public.taches (tenant_id, action_id, libelle, responsable, echeance, statut, priorite) values
    (t, a, 'Réserver la place du village auprès de la mairie', moi, current_date - 10, 'Terminé', 'Haute'),
    (t, a, 'Confirmer les 20 exposants', moi, current_date + 3, 'En cours', 'Haute'),
    (t, a, 'Commander les chalets et l''éclairage', null, current_date - 2, 'À faire', 'Haute'),
    (t, a, 'Préparer les affiches et la publication', moi, current_date + 10, 'À faire', 'Moyenne'),
    (t, a, 'Organiser la buvette et le vin chaud', null, current_date + 15, 'À faire', 'Basse');

  insert into public.actions (tenant_id, emoji, titre, date_action, referent, statut, budget)
  values (t, '🏛️', 'Assemblée générale', current_date + 10, moi, 'En cours', 300) returning id into a;
  insert into public.taches (tenant_id, action_id, libelle, responsable, echeance, statut, priorite) values
    (t, a, 'Réserver la salle des fêtes', moi, current_date - 20, 'Terminé', 'Haute'),
    (t, a, 'Envoyer la convocation aux adhérents', moi, current_date - 1, 'Terminé', 'Haute'),
    (t, a, 'Préparer le rapport moral et financier', moi, current_date + 5, 'En cours', 'Haute'),
    (t, a, 'Recueillir les candidatures au bureau', null, current_date + 7, 'À faire', 'Moyenne'),
    (t, a, 'Prévoir le pot de l''amitié', null, current_date + 9, 'À faire', 'Basse');

  insert into public.actions (tenant_id, emoji, titre, date_action, referent, statut, budget)
  values (t, '📱', 'Atelier : utiliser l''application', current_date + 4, moi, 'À faire', null) returning id into a;
  insert into public.taches (tenant_id, action_id, libelle, responsable, echeance, statut, priorite) values
    (t, a, 'Préparer une démonstration sur grand écran', moi, current_date + 2, 'À faire', 'Moyenne'),
    (t, a, 'Imprimer le code d''accès de l''association', null, current_date + 3, 'À faire', 'Basse');

  insert into public.actions (tenant_id, emoji, titre, date_action, referent, statut, budget)
  values (t, '💶', 'Demande de subvention municipale', current_date + 45, null, 'Bloqué', null) returning id into a;
  insert into public.taches (tenant_id, action_id, libelle, responsable, echeance, statut, priorite) values
    (t, a, 'Obtenir le budget prévisionnel signé du trésorier', null, current_date - 5, 'À faire', 'Haute'),
    (t, a, 'Remplir le dossier en ligne de la mairie', null, current_date + 30, 'À faire', 'Moyenne');

  insert into public.actions (tenant_id, emoji, titre, date_action, referent, statut, budget)
  values (t, '🍻', 'Afterwork des adhérents', current_date + 38, null, 'À faire', 200) returning id into a;
  insert into public.taches (tenant_id, action_id, libelle, responsable, echeance, statut, priorite) values
    (t, a, 'Trouver un commerçant partenaire pour accueillir', null, current_date + 14, 'À faire', 'Moyenne');

  insert into public.actions (tenant_id, emoji, titre, date_action, referent, statut, budget)
  values (t, '🎒', 'Forum des associations', current_date - 50, moi, 'Terminé', 150) returning id into a;
  insert into public.taches (tenant_id, action_id, libelle, responsable, echeance, statut, priorite) values
    (t, a, 'Tenir le stand', moi, current_date - 50, 'Terminé', 'Haute'),
    (t, a, 'Imprimer les flyers', moi, current_date - 55, 'Terminé', 'Moyenne'),
    (t, a, 'Envoyer un message de bienvenue aux nouveaux adhérents', moi, current_date - 45, 'Terminé', 'Basse');
end $$;
