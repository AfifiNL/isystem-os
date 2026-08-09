-- System-seeded Legal Vault templates (workspace_id IS NULL → readable by
-- every workspace). NL-jurisdiction first: DVO (modelovereenkomst-aligned),
-- mutual NDA, processor DPA, basic invoice. The invoice template supports
-- the standard Dutch 21 % BTW regime.
--
-- Universal feature → lives on core (no fork header).

BEGIN;

INSERT INTO public.legal_agreement_templates
  (workspace_id, slug, name, locale, jurisdiction, category, body_mdx, variables, is_active, version)
VALUES
(
  NULL,
  'dvo-nl-zzp-standaard',
  'Dienstverleningsovereenkomst (NL ZZP, standaard)',
  'nl',
  'NL',
  'dvo',
  $TPL$# Dienstverleningsovereenkomst

**Tussen**

{{provider_name}}, gevestigd te {{provider_city}}, KvK-nummer {{provider_kvk}}, BTW-id {{provider_vat}} (hierna: **Opdrachtnemer**),

**en**

{{client_name}}, gevestigd te {{client_city}}, KvK-nummer {{client_kvk}} (hierna: **Opdrachtgever**).

## 1. Opdracht
Opdrachtnemer voert voor Opdrachtgever de volgende werkzaamheden uit: {{scope}}.

## 2. Aard van de overeenkomst
Deze overeenkomst is een opdracht in de zin van artikel 7:400 BW. Tussen partijen ontstaat geen arbeidsovereenkomst. Opdrachtnemer is vrij in de wijze waarop hij de werkzaamheden inricht en bepaalt zelfstandig zijn werktijden. Er is geen gezagsverhouding en Opdrachtnemer mag zich, na overleg, vrijelijk laten vervangen door een gekwalificeerde derde.

## 3. Duur en einde
De overeenkomst gaat in op {{effective_date}} en eindigt op {{expires_at}}, of zoveel eerder als de opdracht is voltooid. Elk der partijen kan met inachtneming van een opzegtermijn van {{notice_period_days}} dagen tussentijds opzeggen.

## 4. Vergoeding
Opdrachtgever betaalt een vergoeding van € {{rate_amount}} ({{rate_basis}}), exclusief 21 % BTW. Facturen worden maandelijks achteraf verzonden en zijn betaalbaar binnen {{payment_term_days}} dagen na factuurdatum.

## 5. Aansprakelijkheid
De aansprakelijkheid van Opdrachtnemer voor schade is beperkt tot het bedrag dat in het betreffende geval onder de beroepsaansprakelijkheidsverzekering van Opdrachtnemer wordt uitgekeerd, vermeerderd met het eigen risico. Indien om welke reden dan ook geen uitkering plaatsvindt, is de aansprakelijkheid beperkt tot het bedrag van de in het lopende kalenderjaar gefactureerde vergoeding, met een maximum van € 25.000.

## 6. Geheimhouding
Partijen verplichten zich tot geheimhouding van alle vertrouwelijke informatie die zij in het kader van deze overeenkomst van elkaar verkrijgen. Deze verplichting blijft van kracht tot vijf jaar na beëindiging van de overeenkomst.

## 7. Verwerking persoonsgegevens
Voor zover Opdrachtnemer in het kader van de opdracht persoonsgegevens verwerkt namens Opdrachtgever, sluiten partijen een afzonderlijke verwerkersovereenkomst die integraal deel uitmaakt van deze overeenkomst.

## 8. Toepasselijk recht
Op deze overeenkomst is uitsluitend Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waar Opdrachtnemer is gevestigd.

---

Aldus overeengekomen en in tweevoud opgemaakt.

**Opdrachtnemer:** {{provider_name}}
**Opdrachtgever:** {{client_name}}
**Datum:** {{effective_date}}
$TPL$,
  $VARS$[
    {"key":"provider_name","label":"Naam Opdrachtnemer","type":"string","required":true,"defaultValue":""},
    {"key":"provider_city","label":"Vestigingsplaats Opdrachtnemer","type":"string","required":true,"defaultValue":"Amsterdam"},
    {"key":"provider_kvk","label":"KvK-nummer Opdrachtnemer","type":"string","required":true},
    {"key":"provider_vat","label":"BTW-id Opdrachtnemer","type":"string","required":true},
    {"key":"client_name","label":"Naam Opdrachtgever","type":"string","required":true},
    {"key":"client_city","label":"Vestigingsplaats Opdrachtgever","type":"string","required":true},
    {"key":"client_kvk","label":"KvK-nummer Opdrachtgever","type":"string","required":false},
    {"key":"scope","label":"Omschrijving werkzaamheden","type":"multiline","required":true},
    {"key":"effective_date","label":"Ingangsdatum","type":"date","required":true},
    {"key":"expires_at","label":"Einddatum","type":"date","required":false},
    {"key":"notice_period_days","label":"Opzegtermijn (dagen)","type":"number","required":true,"defaultValue":30},
    {"key":"rate_amount","label":"Tarief (EUR, excl. BTW)","type":"string","required":true},
    {"key":"rate_basis","label":"Tariefbasis (per uur / per project)","type":"string","required":true,"defaultValue":"per uur"},
    {"key":"payment_term_days","label":"Betalingstermijn (dagen)","type":"number","required":true,"defaultValue":14}
  ]$VARS$::jsonb,
  true,
  1
),
(
  NULL,
  'nda-mutual-nl',
  'Geheimhoudingsverklaring (wederkerig)',
  'nl',
  'NL',
  'nda',
  $TPL$# Wederkerige geheimhoudingsverklaring

**Partijen:** {{party_a}} en {{party_b}} (gezamenlijk: **Partijen**).

## 1. Doel
Partijen wensen vertrouwelijke informatie uit te wisselen ten behoeve van: {{purpose}}.

## 2. Vertrouwelijke informatie
Onder Vertrouwelijke Informatie wordt verstaan alle informatie die door één Partij aan de andere wordt verstrekt en die naar redelijke maatstaven als vertrouwelijk dient te worden beschouwd, in welke vorm dan ook.

## 3. Verplichtingen
Partijen zullen Vertrouwelijke Informatie:
- uitsluitend gebruiken voor het in artikel 1 genoemde doel;
- niet aan derden bekend maken zonder voorafgaande schriftelijke toestemming;
- met dezelfde zorgvuldigheid behandelen als hun eigen vertrouwelijke informatie, en in elk geval met redelijke zorgvuldigheid.

## 4. Uitzonderingen
De verplichtingen in artikel 3 zijn niet van toepassing op informatie die (a) openbaar is of wordt zonder schending van deze overeenkomst, (b) reeds aantoonbaar bij de ontvangende Partij bekend was, (c) onafhankelijk is ontwikkeld zonder gebruik van Vertrouwelijke Informatie, of (d) krachtens een wettelijke verplichting moet worden verstrekt.

## 5. Duur
De geheimhoudingsverplichting blijft van kracht tot {{duration_years}} jaar na de datum van ondertekening.

## 6. Toepasselijk recht
Op deze overeenkomst is Nederlands recht van toepassing.

---

**{{party_a}}** — {{effective_date}}
**{{party_b}}** — {{effective_date}}
$TPL$,
  $VARS$[
    {"key":"party_a","label":"Partij A","type":"string","required":true},
    {"key":"party_b","label":"Partij B","type":"string","required":true},
    {"key":"purpose","label":"Doel uitwisseling","type":"multiline","required":true},
    {"key":"duration_years","label":"Looptijd geheimhouding (jaren)","type":"number","required":true,"defaultValue":3},
    {"key":"effective_date","label":"Ingangsdatum","type":"date","required":true}
  ]$VARS$::jsonb,
  true,
  1
),
(
  NULL,
  'dpa-processor-nl',
  'Verwerkersovereenkomst (AVG)',
  'nl',
  'NL',
  'dpa',
  $TPL$# Verwerkersovereenkomst

**Verwerkingsverantwoordelijke:** {{controller_name}}
**Verwerker:** {{processor_name}}

## 1. Onderwerp
Verwerker verwerkt in opdracht van Verwerkingsverantwoordelijke persoonsgegevens in het kader van: {{service_description}}.

## 2. Aard, doel en duur
- **Aard:** {{processing_nature}}
- **Doel:** {{processing_purpose}}
- **Duur:** zolang de onderliggende dienstverleningsovereenkomst van kracht is.

## 3. Categorieën betrokkenen en gegevens
- **Categorieën betrokkenen:** {{data_subjects}}
- **Categorieën persoonsgegevens:** {{data_categories}}

## 4. Instructies
Verwerker verwerkt persoonsgegevens uitsluitend op gedocumenteerde instructie van Verwerkingsverantwoordelijke, inclusief doorgiften aan derde landen, tenzij een wettelijke verplichting hem tot verwerking verplicht.

## 5. Beveiligingsmaatregelen
Verwerker treft passende technische en organisatorische beveiligingsmaatregelen conform artikel 32 AVG, waaronder versleuteling in rust en transport, toegangscontrole op basis van least-privilege, en periodieke beveiligingsaudits.

## 6. Subverwerkers
Verwerker maakt uitsluitend gebruik van subverwerkers met voorafgaande schriftelijke toestemming van Verwerkingsverantwoordelijke en sluit met elke subverwerker een schriftelijke verwerkersovereenkomst met ten minste dezelfde verplichtingen.

## 7. Datalek
Verwerker meldt elk datalek binnen 24 uur na ontdekking bij Verwerkingsverantwoordelijke en verleent alle redelijke medewerking bij de afhandeling.

## 8. Audit
Verwerkingsverantwoordelijke is gerechtigd ten hoogste eenmaal per kalenderjaar op eigen kosten een audit te (laten) uitvoeren bij Verwerker, met inachtneming van een aankondigingstermijn van dertig dagen.

## 9. Beëindiging
Bij beëindiging retourneert of vernietigt Verwerker, ter keuze van Verwerkingsverantwoordelijke, alle persoonsgegevens binnen dertig dagen, tenzij een wettelijke bewaarplicht anders bepaalt.

## 10. Toepasselijk recht
Op deze overeenkomst is Nederlands recht van toepassing.

---

**{{controller_name}}** — {{effective_date}}
**{{processor_name}}** — {{effective_date}}
$TPL$,
  $VARS$[
    {"key":"controller_name","label":"Verwerkingsverantwoordelijke","type":"string","required":true},
    {"key":"processor_name","label":"Verwerker","type":"string","required":true},
    {"key":"service_description","label":"Onderliggende dienst","type":"multiline","required":true},
    {"key":"processing_nature","label":"Aard van de verwerking","type":"multiline","required":true},
    {"key":"processing_purpose","label":"Doel van de verwerking","type":"multiline","required":true},
    {"key":"data_subjects","label":"Categorieën betrokkenen","type":"string","required":true},
    {"key":"data_categories","label":"Categorieën persoonsgegevens","type":"string","required":true},
    {"key":"effective_date","label":"Ingangsdatum","type":"date","required":true}
  ]$VARS$::jsonb,
  true,
  1
),
(
  NULL,
  'invoice-nl-zzp-standard',
  'Factuur (NL ZZP, 21% BTW)',
  'nl',
  'NL',
  'invoice',
  $TPL$# Factuur {{invoice_number}}

**{{provider_name}}**
KvK {{provider_kvk}} · BTW-id {{provider_vat}}
{{provider_address}}

---

**Aan:** {{client_name}}
{{client_address}}
{{#client_vat}}BTW-id: {{client_vat}}{{/client_vat}}

**Factuurdatum:** {{invoice_date}}
**Vervaldatum:** {{due_date}}
**Referentie:** {{reference}}

| Omschrijving | Aantal | Tarief | Bedrag (excl. BTW) |
|---|---:|---:|---:|
| {{line_description}} | {{line_quantity}} | € {{line_unit_price}} | € {{line_amount_excl}} |

**Subtotaal (excl. BTW):** € {{line_amount_excl}}
**BTW 21 %:** € {{btw_amount}}
**Totaal te voldoen:** € {{amount_incl}}

Gelieve het factuurbedrag binnen {{payment_term_days}} dagen over te maken op IBAN {{iban}} t.n.v. {{provider_name}} onder vermelding van factuurnummer {{invoice_number}}.
$TPL$,
  $VARS$[
    {"key":"invoice_number","label":"Factuurnummer","type":"string","required":true},
    {"key":"provider_name","label":"Naam Opdrachtnemer","type":"string","required":true,"defaultValue":""},
    {"key":"provider_kvk","label":"KvK-nummer","type":"string","required":true},
    {"key":"provider_vat","label":"BTW-id","type":"string","required":true},
    {"key":"provider_address","label":"Adres Opdrachtnemer","type":"multiline","required":true},
    {"key":"client_name","label":"Naam klant","type":"string","required":true},
    {"key":"client_address","label":"Adres klant","type":"multiline","required":true},
    {"key":"client_vat","label":"BTW-id klant","type":"string","required":false},
    {"key":"invoice_date","label":"Factuurdatum","type":"date","required":true},
    {"key":"due_date","label":"Vervaldatum","type":"date","required":true},
    {"key":"reference","label":"Referentie / projectcode","type":"string","required":false},
    {"key":"line_description","label":"Omschrijving werkzaamheden","type":"multiline","required":true},
    {"key":"line_quantity","label":"Aantal eenheden","type":"number","required":true},
    {"key":"line_unit_price","label":"Tarief per eenheid (EUR)","type":"string","required":true},
    {"key":"line_amount_excl","label":"Bedrag excl. BTW (EUR)","type":"string","required":true},
    {"key":"btw_amount","label":"BTW-bedrag (EUR)","type":"string","required":true},
    {"key":"amount_incl","label":"Totaal incl. BTW (EUR)","type":"string","required":true},
    {"key":"payment_term_days","label":"Betalingstermijn (dagen)","type":"number","required":true,"defaultValue":14},
    {"key":"iban","label":"IBAN","type":"string","required":true}
  ]$VARS$::jsonb,
  true,
  1
)
ON CONFLICT DO NOTHING;

COMMIT;
