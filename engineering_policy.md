### Engineering Policy (Täiendatud versioon)

#### 1. Versioonihaldus ja töövoog

* Igale muudatusele peab eelnema issue.
* Kõik poolikud muudatused arendatakse `feature` või `bugfix` harudes.
* Kõik loodud haru nimed sisaldavad issue numbrit, millega haru seotud on. Nt: `124-fix-header`
* Iga haru on seotud ainult ühe issuega.
* Otse `main` harusse tehtud mitte-terviklikud ja/või issue'ga mitteseotud commitid on rangelt keelatud.
* `main` haru peab olema alati *deployable* ja läbima kõik testid.
* `main` haru *commit-sõnumid* kasutavad ühte/kahte üldist formaati (conventional commits, connextra vms).

---

#### 1.1 Issue'de tüübid ja vorming (**kohustuslik**)

##### Feature issue

**Title**

```
As a [role] I [can/want to] [action] so that [benefit]
```

**Body**

```
[1–3 lauset, mis selgitavad inglise keeles miks see funktsionaalsus on vajalik ja millist probleemi see lahendab]

**Acceptance criteria**

* Üks lause rea kohta
* Algab suure tähega
* Deklaratiivne ja testitav
* Ei sisalda nummerdamist
* Ei dubleeri implementatsiooni
* Võib kasutada Given–When–Then struktuuri
```

Acceptance criteria moodustab **lepingu** ja **testimise aluse** – kood on valmis alles siis, kui kõik tingimused on täidetud.

---

##### Bug issue

**Title**

```
Bug: [lühike ja konkreetne kirjeldus]
```

**Body**

```
1. Reproduction steps
[Selged ja korduvad sammud vea taastootmiseks]

Expected:
[Kirjeldus oodatud käitumisest]

Actual:
[Kirjeldus tegelikust käitumisest]
```

* Bug-issue peab olema reprodutseeritav.
* Bug-fix PR peab sisaldama regressioonitesti, mis ebaõnnestub enne parandust ja läbib pärast parandust.

#### 2. Koodi kvaliteet ja stiil
- Projekt kasutab ühtset koodiformaati ja lintimist, mis on CI-s jõustatud.
- Kood järgib **SOLID** printsiipe ning vältib dubleerimist (**DRY**).
- Koodis ei ole “magic numbers”, kommenteeritud koodiplokke ega kõvakodeeritud konf-väärtuseid.
- Funktsioonid on lühikesed, loetavad ja täidavad ühte vastutust.
- Koodi ei *merge*’ita, kui lint, *build* või testid ebaõnnestuvad. Seda peab automaatselt tagama (nt Husky)
- Kui projekt kasutab TypeScripti, siis tuleb vältida `any` tüübi kasutamist, välja arvatud selgelt põhjendatud erandjuhtudel.

#### 3. Testimine ja kvaliteedikontroll

* Äriloogika testide katvus on vähemalt **80%**; kriitiliste teenuste katvus on kõrgem.
* Kõik kasutusvood (nt autentimine, maksed, profiili haldus jt) on kaetud **E2E** testidega.
* Iga vea parandusega peab kaasnema regressioonitest.
* Testid jooksevad automaatselt igal PR-il ning katkine test peatab *merge*’i.
* Testandmed (fixtures/mocks) on koodist eraldatud ja korduvkasutatavad.
* **Teste ei tohi üles ehitada mockitud äriloogika peale.** Mockida võib vaid väliseid sõltuvusi (nt kolmanda osapoole teenused, aga mitte andmebaasipäringuid).
* **Iga test peab minema punaseks, kui vastav olukord või loogika koodis muutub.** Test ei tohi dubleerida implementatsiooni; test peab valideerima käitumist, mitte mockitud sisendeid.


#### 4. CI/CD ja deploy-poliitika
- *Build*, *test* ja *deploy* on täielikult automatiseeritud (võib panna live asemel staging serverisse autodeploy).
- Deployment tugineb immuuntaristule (Docker/k8s); tootmiskeskkonda ei tehta käsitsi muudatusi.
- Sõltuvuste versioonid on fikseeritud (*lock*-failid), et tagada keskkondade identsus.

#### 5. Arhitektuur ja dokumentatsioon
- Kõik olulised arhitektuuriotsused dokumenteeritakse **ADR**-idena.
- API-dokumentatsioon (REST/GraphQL) hoitakse ajakohasena ja automaatselt genereerituna.
- Igal moodulil peab olema lühike `README` (paigaldus, käivitamine, testimine).
- Projekti kaustastruktuur peab olema ühtne (nt `src/`, `tests/`, `docs/`, `config/`).
- API muudatused peavad olema tagasiühilduvad või kasutama versioonimist.

#### 6. Turvalisus
- Projektis ei hoita paroole, võtmeid ega *token*’eid koodibaasis (.env failid ei ole Gitis).
- Kõik sisendid valideeritakse; SQL-i ja API-päringute puhul kasutatakse parameetriseerimist.
- Sõltuvused läbivad regulaarse automaatse turvaskaneerimise (SCA).
- Tundlikku infot (PII) ei logita ning logid saadetakse tsentraalsesse logisüsteemi.
- HTTPS (TLS 1.2+) on tootmises kohustuslik.
- Autoriseerimiskontroll toimub alati serveri poolel, mitte ainult UI-s.

#### 7. Logimine, monitooring ja insidendihaldus
- Rakendusel peab olema *health-check* endpoint või *native* “health indicator”.
- Logid on struktureeritud (JSON) ja sisaldavad `trace_id`-d päringute jälgimiseks.
- Projekt kasutab veajälgimist (Sentry, Rollbar vms) koos reaalajas teavitustega.
- Insidentide käsitlemiseks on selge eskaleerimisprotsess ja SLA-d.

#### 8. Pull Request nõuded
- PR peab olema väike ja käsitlema ühte konkreetset muudatust.
- PR-is peab olema selgitus: mida muudeti ja miks (vajadusel viide piletile).
- PR-id, mis mõjutavad arhitektuuri või andmemudelit, vajavad *Tech Lead*'i kinnitust.
- PR ei tohi ületada kokkulepitud maksimaalset mahtu (nt 400 rida), v.a erandid.

#### 9. Andmebaasid ja andmehalus
- Andmebaasi skeemimuudatused tehakse ainult verisoonitud **migratsiooniskriptidega**.
- Hävitavad muudatused (nt tulba kustutamine) vajavad mitme-etapilist *deploy*-protsessi.
- Andmebaasi päringud on optimeeritud (indeksid, N+1 probleemi vältimine).
- Tootmisandmebaasile puudub arendajatel otse-kirjutamisõigus.

#### 10. Jõudlus ja skaleeritavus
- Ajakulukad operatsioonid (nt e-mailide saatmine, failitöötlus) toimuvad asünkroonselt taustatöödena (*background jobs*).
- Korduvate ja kulukate päringute puhul on rakendatud vahemälu (*caching*) strateegia.
- Staatiline sisu serveeritakse optimeeritult (CDN, pakkimine/minimeerimine).

---
#### Minimum Compliance
Projekti peetakse reeglitega vastavaks, kui:
* kõik punktid **1.1–1.5**, **2.1–2.6**, **3.1–3.4**, **6.1-6.6** ja **9.1** on täidetud,
* ülejäänud kategooriad on vähemalt **80%** ulatuses rakendatud.

