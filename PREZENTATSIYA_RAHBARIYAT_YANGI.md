# Rahbariyat uchun prezentatsiya matni

Ushbu matn Data Warehouse demo loyihasini rahbariyatga tushuntirish uchun tayyorlandi. Demo web interfeys orqali ko'rsatiladi va har bir bosqichda ma'lumot oqimi qanday ishlashini amaliy ko'rinishda beradi.

Demo manzili:

```text
http://172.16.4.138:7777
```

Asosiy g'oya: ma'lumot manbadan keladi, Data Warehouse pipeline ichidan o'tadi, tekshiriladi, tozalanadi, versionlanadi, analitik bazaga yuklanadi va oxirida foydalanuvchiga dashboard/API natija sifatida ko'rsatiladi.

## 1. Kirish matni

Bugungi demo oddiy arxitektura rasmi emas. Bu yerda Data Warehouse jarayoni web interfeysda bosqichma-bosqich ko'rsatiladi. Har bir stepda qaysi texnologiya nima vazifa bajarishi, data qanday o'zgarishi va natijada qayerga yozilishi ko'rinadi.

Demo test API orqali ishlaydi. Bu xavfsiz yondashuv: real vazirlik yoki idora tizimlariga ulanmasdan, Data Warehouse jarayonini to'liq tushuntirish mumkin. Test API ichida ataylab bo'sh va `null` qiymatlar bor, shuning uchun data preparation, imputation va quality tekshiruvlarini real ko'rsatish mumkin.

Demo vaqtida statuslarga e'tibor beramiz:

- `REAL EXECUTED` - shu run ichida real kod ishlagan va natija qaytargan.
- `AVAILABLE` - texnologiya yoki modul tayyor, lekin hozirgi demo run ichida alohida servis sifatida ishga tushmagan.
- `NOT CONNECTED` - arxitekturada bor, lekin demo scope ichida ulanmagan.

Bu yondashuv halol: qaysi qism hozir real ishlayotganini, qaysi qism keyingi production integratsiya ekanini yashirmaydi.

## 2. Demo qanday boshlanadi

Prezentatsiyada avval xaritaning boshidagi 4 ta source ichidan bittasi tanlanadi: Local Test API, eStat 4.0, SIAT API yoki Planshet Survey. Keyin Run scenario tugmasi bosiladi. Pipeline aynan tanlangan source ID bilan avtomatik yuradi. Har bir step taxminan 3 sekund ko'rinadi. Step bosilganda o'ng tomondagi panelda shu bosqichning vazifasi, input-output, metrics, kod namunasi va real natija chiqadi.

Agar `Data Preparation / Imputation` bosqichiga kelinsa, jarayon to'xtaydi. Bu ataylab qilingan: operator prepared versionni tanlaydi, shundan keyin flow quality va DWH bosqichlariga davom etadi.

## 3. Step 1 - Ma'lumot manbalari

Scenario xaritasining boshida 4 ta source vertikal ko'rinishda turadi. Operator ulardan bittasini tanlaydi va faqat tanlangan manba ACTIVE holatiga o'tadi.

Tushuntirish matni:

"Har bir Data Warehouse jarayoni aniq manbadan boshlanishi kerak. Bu yerda Local Test API, eStat 4.0, SIAT API va Planshet Survey manbalari bor. Tanlangan source ID, endpoint va collection FastAPI requestga uzatiladi. Shu sababli keyingi barcha natijalar qaysi manbadan kelgani auditda aniq ko'rinadi."

Ko'rsatish kerak bo'lgan joylar:

- 4 ta source kartasi;
- tanlangan kartadagi ACTIVE statusi;
- source title va collection;
- source o'zgarganda eski run natijasi tozalanishi;
- Run scenario aynan tanlangan source bilan ishlashi.

## 4. Step 2 - FastAPI Gateway

Bu Data Warehousega kirish nuqtasi. Frontenddan kelgan request FastAPI backendga boradi. FastAPI source, limit va mode qiymatlarini qabul qiladi, keyin test API dan JSON data oladi.

Tushuntirish matni:

"Bu bosqichda ma'lumot birinchi marta tizimga kiryapti. FastAPI gateway vazifasini bajaradi: requestni qabul qiladi, source parametrlarini tekshiradi va tashqi yoki lokal API dan JSON payload oladi. Keyingi barcha bosqichlar shu run_id orqali kuzatiladi."

Ko'rsatish kerak bo'lgan joylar:

- source tanlanganini ko'rsatish;
- records sonini ko'rsatish;
- API response previewni ko'rsatish;
- status `REAL EXECUTED` bo'lsa, bu kod real ishlaganini aytish.

## 5. Step 3 - NiFi / Kafka Ingestion

Bu bosqich ingestion va event oqimini bildiradi. Productionda NiFi data flow routing uchun, Kafka esa event-driven signal uchun ishlatiladi. Demo ichida Kafka/event qismi real bajariladi, NiFi esa arxitektura qatlami sifatida ko'rsatiladi.

Tushuntirish matni:

"Manbalar ko'payganda ma'lumotlarni qo'lda ulash qiyinlashadi. Shuning uchun ingestion qatlami kerak. NiFi qaysi manbadan kelgan data qayerga borishini boshqaradi, Kafka esa pipeline hodisasini boshqa servislar uchun event sifatida uzatadi."

Ko'rsatish kerak bo'lgan joylar:

- event metadata;
- topic yoki Kafka event ma'lumotlari;
- `REAL EXECUTED` va `AVAILABLE` farqini tushuntirish.

## 6. Step 4 - MinIO Landing / Raw

Bu bosqichda kelgan data object storagega yoziladi. Landing qismi original payloadni saqlaydi, Raw qismi esa keyingi processing uchun row formatga yaqinlashtirilgan xom datani saqlaydi.

Tushuntirish matni:

"Landing va Raw zonalar audit uchun juda muhim. Landing - manbadan kelgan asl JSON. Raw - keyingi ishlov berish uchun ajratilgan xom rowlar. Agar keyin data xatosi chiqsa, biz manbadan nima kelganini va pipeline nima qilganini solishtira olamiz."

Ko'rsatish kerak bo'lgan joylar:

- storage path;
- landing/raw objectlar;
- data size;
- input va output farqi.

## 7. Step 5 - Data Preparation / Imputation

Bu demo ichidagi eng muhim bosqichlardan biri. Xom data to'g'ridan-to'g'ri DWHga ketmaydi. Avval profiling, normalize, null qiymatlarni to'ldirish, qo'lda edit va prepared version tanlash bajariladi.

Tushuntirish matni:

"Data Warehousega sifatsiz data kiritilmasligi kerak. Shu bosqichda pipeline bo'sh yoki noto'g'ri qiymatlarni topadi, kerak bo'lsa imputation qiladi, operator qo'lda tuzatishi mumkin va natijada prepared version yaratiladi. Raw data o'zgarmaydi, yangi prepared version saqlanadi."

Muhim gap:

"Jarayon shu joyda to'xtashi boshqaruv uchun kerak. Chunki ayrim data avtomatik tozalanadi, lekin ayrim holatlarda mas'ul xodim prepared versionni tanlab tasdiqlashi kerak."

Ko'rsatish kerak bo'lgan joylar:

- null/imputed qiymatlar;
- manual edit table;
- version ID lar;
- `Continue to Quality` tugmasi;
- raw immutable, prepared version, quality version, DWH version ketma-ketligi.

## 8. Step 6 - Quality Gate

Bu bosqichda prepared data validatsiyadan o'tadi. Great Expectations kabi quality mexanizmi record count, primary key, schema va null thresholdni tekshiradi.

Tushuntirish matni:

"Data tayyorlangandan keyin ham darhol DWHga yozilmaydi. Avval quality gate bor. Agar majburiy fieldlar bo'sh bo'lsa yoki schema noto'g'ri bo'lsa, pipeline shu yerda to'xtashi kerak. Bu noto'g'ri data DWHga kirib ketishining oldini oladi."

Ko'rsatish kerak bo'lgan joylar:

- quality score;
- passed/failed checks;
- validation natijasi;
- error scenario tanlansa pipeline qayerda to'xtashini ko'rsatish.

## 9. Step 7 - Transform / Curated Model

Bu bosqichda prepared data analytics modelga aylantiriladi. Entity, category, metric kabi business fieldlar hosil qilinadi. Natijada dashboard va DWH uchun qulay curated schema paydo bo'ladi.

Tushuntirish matni:

"Prepared data hali analitik model emas. Bu bosqichda data biznes ma'noga ega ko'rinishga o'tadi. Masalan, mahsulot, kategoriya, metrika, status kabi umumiy fieldlar yaratiladi. Shu format keyingi ClickHouse va dashboardlar uchun ishlatiladi."

Ko'rsatish kerak bo'lgan joylar:

- curated preview;
- oldin/keyin farqi;
- transform metrics;
- PySpark yoki transform code oynasi.

## 10. Step 8 - Warehouse Modeling

Bu bosqich curated datani DWH biznes modeliga moslaydi. dbt staging, fact, dimension, KPI va business rule SQL qatlamlarini tartibli model sifatida tayyorlaydi va testlaydi.

Tushuntirish matni:

"Curated data hali tayyor Data Warehouse modeli emas. Warehouse Modeling bosqichida qaysi field fact, qaysi ma'lumot dimension va qaysi formula KPI ekanligi belgilanadi. dbt SQL modellar bu qoidalarni kod sifatida saqlaydi va ClickHousega faqat tartibli analitik model uzatiladi. Demo run ichida dbt CLI ishga tushmagani uchun bu step AVAILABLE holatda ko'rsatiladi."

Ko'rsatish kerak bo'lgan joylar:

- dbt staging va mart modeli;
- fact/dimension tuzilmasi;
- KPI business rule;
- SQL testlar va AVAILABLE statusi.

## 11. Step 9 - ClickHouse DWH

Bu bosqich Warehouse Modeling tayyorlagan datani fizik analitik bazaga yozadi. ClickHouse katta hajmdagi aggregatsiya, KPI va dashboard querylari uchun DWH storage vazifasini bajaradi.

Tushuntirish matni:

"Warehouse Modeling mantiqiy modelni tayyorladi, ClickHouse esa shu modelni real jadvalga yuklaydi. Bu yerda analytical table yaratiladi, curated recordlar batch insert qilinadi va keyingi dashboard hamda querylar uchun tayyor bo'ladi. Demo natijasida qaysi tablega nechta record real yuklangani ko'rinadi."

Ko'rsatish kerak bo'lgan joylar:

- ClickHouse table nomi;
- uploaded records;
- batch insert natijasi;
- REAL EXECUTED statusi, metrics va duration.

## 12. Step 10 - PostgreSQL Audit

Bu bosqich DWH datasi emas, jarayon metadata va auditini saqlash uchun kerak. Run status, warninglar, quality score, record count kabi ma'lumotlar PostgreSQLda saqlanishi mumkin.

Tushuntirish matni:

"PostgreSQL bu yerda analitik data uchun emas, pipeline nazorati uchun ishlatiladi. Qaysi run qachon ishga tushdi, nechta record o'tdi, quality necha foiz bo'ldi, warning bo'ldimi - bular audit va monitoring uchun kerak."

Ko'rsatish kerak bo'lgan joylar:

- run_id;
- status;
- warninglar;
- audit metadata.

## 13. Step 11 - Trino Query

Trino bir nechta storage va database ustidan bitta SQL so'rov qatlamini beradi. Masalan, analitik MinIO, ClickHouse yoki boshqa cataloglardagi datani ad-hoc query bilan birga o'qishi mumkin.

Tushuntirish matni:

"Trino data saqlaydigan baza emas. U distributed SQL engine. Pipeline ClickHouse load tugagach Trino /v1/statement endpointiga joriy run bo'yicha count va metric_sum SQL so'rovini yuboradi. O'ng panelda real query_id, result rows va query stats ko'rinadi. Service ishlamasa step REAL EXECUTED emas, WARNING bo'lib chiqadi."

Ko'rsatish kerak bo'lgan joylar:

- ClickHouse'dan Trino branch chizig'i;
- clickhouse catalog, yuborilgan SQL va result processlari;
- o'ng paneldagi Trino tavsifi;
- query_id, records, metric_sum va REAL EXECUTED statusi.

## 14. Step 12 - Apache Superset

Superset ClickHouse DWH ustidagi BI va dashboard qatlamidir. Dataset, chart, KPI va rahbariyat dashboardlari shu qatlamda quriladi.

Tushuntirish matni:

"ClickHouse tayyor analitik datani saqlaydi, Superset esa uni grafik va dashboard ko'rinishida beradi. Pipeline Superset healthni tekshiradi, REST API orqali login qiladi, ClickHouse DWH connectionni va dwh.curated_events datasetini yaratadi yoki mavjudini topadi. O'ng panelda real database_id, dataset_id va Explore URL ko'rinadi."

Ko'rsatish kerak bo'lgan joylar:

- ClickHouse'dan Superset branch chizig'i;
- health, login, database va dataset provisioning processlari;
- dashboard uchun tayyor curated table;
- database_id, dataset_id, Explore URL va REAL EXECUTED statusi.

## 15. Step 13 - Visualization / Delivery

Bu yakuniy bosqich. Data faqat bazada qolmaydi, foydalanuvchiga ko'rinarli natija sifatida chiqadi. Hozirgi UI ichida dashboard preview, API response, upload/DWH load result va export pathlar ko'rsatiladi.

Tushuntirish matni:

"Data Warehousening qiymati yakunda foydalanuvchi natijani ko'rganida bilinadi. Shu bosqichda rahbariyat uchun dashboard KPI, API response, DWHga yuklangan recordlar va export yo'llari ko'rsatiladi. Ya'ni data manbadan kelib, nazoratdan o'tib, analitik natijaga aylanganini ko'ramiz."

Ko'rsatish kerak bo'lgan joylar:

- Dashboard rows;
- API records;
- Quality;
- Total metric;
- real data result preview;
- API JSON response;
- Upload / DWH load;
- export pathlar.

## 16. Rahbariyatga aytiladigan yakuniy gap

"Ushbu demo Data Warehouse jarayonini end-to-end tushuntiradi. Operator 4 ta source ichidan bittasini tanlaydi. Ma'lumot ingestion va storage qatlamlaridan o'tadi, preparation va quality gate orqali nazorat qilinadi, curated modelga aylanadi. Warehouse Modeling fact, dimension va KPI qoidalarini tayyorlaydi, ClickHouse esa tayyor modelni real DWH jadvaliga yuklaydi. Trino ClickHouse ustida real query bajaradi, Superset ClickHouse database va datasetini real ro'yxatdan o'tkazadi, PostgreSQL auditni saqlaydi va oxirida portal/API natijasi chiqadi. Demo hozir production cluster emas, lekin arxitektura, jarayon va boshqaruv logikasi real tizimga ulash uchun tayyor konsept sifatida ko'rsatilgan."

## 17. Savol bo'lsa javob berish uchun qisqa izohlar

Savol: Bu real datami?

Javob: Demo xavfsiz bo'lishi uchun test API ishlatilgan. Lekin pipeline ichidagi qabul qilish, tozalash, validation, transform va natija ko'rsatish logikasi real Data Warehouse jarayoniga mos.

Savol: Nega ayrim texnologiyalar `AVAILABLE`?

Javob: Ular arxitekturada ko'zda tutilgan, lekin demo run ichida alohida production service sifatida ishga tushirilmagan. Bu farq interfeysda halol ko'rsatilgan.

Savol: Data Preparation nima uchun kerak?

Javob: Xom data sifatsiz bo'lishi mumkin. DWHga noto'g'ri data ketmasligi uchun profiling, null to'ldirish, qo'lda edit va version tanlash kerak.

Savol: Nega version tanlanadi?

Javob: Har bir recordning raw va prepared holati ajratiladi. Raw data buzilmaydi, prepared version esa quality va DWHga uzatiladi. Bu audit va nazorat uchun muhim.

Savol: Yakunda nima natija olinadi?

Javob: Dashboard KPI, API JSON response, DWH load result, export pathlar va audit metadata olinadi.
