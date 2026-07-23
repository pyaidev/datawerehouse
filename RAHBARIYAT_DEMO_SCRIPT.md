# Data Warehouse demo prezentatsiya matni

Ushbu matn rahbariyatga demo ko'rsatishda har bir stepda to'xtab tushuntirish uchun tayyorlangan. Demo manzili:

```text
http://172.16.4.138:7777
```

Demo source:

```text
Local Test API - Null Products
```

Bu source ataylab `null`, bo'sh string va tuzatish talab qiladigan qiymatlar bilan tayyorlangan. Maqsad: Data Warehousega ketishdan oldin data qanday qabul qilinishi, tozalanishi, imputation qilinishi, versionlanishi, validatsiya qilinishi va DWHga yuklanishini bosqichma-bosqich ko'rsatish.

## Kirish

Bugungi demo Data Warehouse arxitekturasining ish jarayonini real API orqali ko'rsatadi. Biz tashqi API o'rniga lokal test API ishlatyapmiz, chunki tashqi DummyJSON datada `null` qiymatlar deyarli yo'q. Rahbariyat uchun muhim joy shuki: demo faqat chizma emas, pipeline ichida real backend bosqichlari ishlaydi.

Statuslar uch xil:

- `REAL EXECUTED` - shu run ichida real kod ishladi.
- `AVAILABLE` - komponent yoki kod tayyor, lekin shu run ichida alohida ishga tushmagan.
- `NOT CONNECTED` - arxitekturada bor, lekin demo scope ichida real servisga ulanmagan.

Bu statuslarni yashirmaymiz. Shuning uchun demo halol: qaysi qism real ishlayotganini va qaysi qism keyingi integratsiya ekanini ochiq ko'rsatadi.

## 1. FastAPI Gateway

Bu birinchi kirish nuqtasi. Frontenddan `Run scenario` bosilganda request avval FastAPI backendga boradi. FastAPI source, limit va run mode qiymatlarini qabul qiladi.

Bu demoda FastAPI tashqi internet API emas, o'zimizning lokal test API'ni chaqiradi:

```text
/test-api/products-null
```

Bu API mahsulotlar ro'yxatini JSON formatda qaytaradi. Ichida ataylab `brand=null`, `price=null`, `weight=null`, `stock=null`, `dimensions.width=null`, `reviewerEmail=null` kabi qiymatlar bor. Bu data keyingi `Data Preparation` va `Imputatsiya / Edit` bosqichlarini real ko'rsatish uchun kerak.

Tushuntirish matni:

“Bu yerda Data Warehousega kirayotgan ma'lumot birinchi marta qabul qilinyapti. FastAPI gateway source bilan ishlaydi, requestni tekshiradi va xom JSON payloadni oladi. Hozir ishlayotgan source lokal test API, shuning uchun null qiymatlar bor va keyingi bosqichlarda ular qayta ishlanadi.”

## 2. Apache NiFi

NiFi statusi `AVAILABLE`. Bu shuni bildiradi: arxitekturada data flow, routing va transformatsiya uchun NiFi ko'zda tutilgan, lekin hozirgi demo run ichida NiFi alohida flow sifatida trigger qilinmayapti.

Tushuntirish matni:

“NiFi bu yerda ingestion flow boshqaruvi uchun turibdi. Real productionda source'dan kelgan ma'lumotlarni marshrutlash, formatlash, flowfile metadata qo'shish va kerakli zonaga yuborish NiFi orqali bo'ladi. Demo scope'da bu vazifa FastAPI pipeline ichida soddalashtirilgan, shuning uchun status `AVAILABLE`.”

## 3. Apache Kafka

Kafka `REAL EXECUTED`. FastAPI data olgandan keyin pipeline event yaratadi va Kafka topicga yozadi.

Bu eventda odatda quyidagilar bo'ladi:

- `run_id`
- `source`
- `mode`
- `records`
- `created_at`

Tushuntirish matni:

“Bu bosqichda pipeline ingestion event yaratadi. Ma'lumotning o'zi emas, balki pipeline hodisasi Kafka orqali uzatiladi. Bu real-time monitoring, boshqa servislarni xabardor qilish va event-driven architecture uchun kerak.”

## 4. MinIO Landing Zone

Landing Zone `REAL EXECUTED`. Bu yerda original payload saqlanadi. Ya'ni API'dan qanday JSON kelgan bo'lsa, o'sha holatda object storagega yoziladi.

Muhim nuqta: landing data o'zgartirilmaydi.

Tushuntirish matni:

“Landing Zone - bu kelgan dataning asl nusxasi. Bu yerdagi data audit uchun muhim: keyin xato bo'lsa, manbadan nima kelganini aniq ko'rish mumkin. Biz bu bosqichda datani tozalamaymiz, faqat saqlaymiz.”

## 5. MinIO Raw Zone

Raw Zone `REAL EXECUTED`. Landing payload ichidan kerakli collection olinadi, masalan `products`, va rowlar ro'yxati sifatida raw zonaga yoziladi.

Landing bilan farqi:

- Landing - original API payload.
- Raw - pipeline ishlashi uchun ajratilgan rowlar.

Tushuntirish matni:

“Raw Zone'da ma'lumot hali biznes model emas. Bu hali xom rowlar. Lekin endi pipeline uni jadvalga yaqinroq formatda ko'ra oladi. Keyingi Data Preparation aynan shu raw rowlar ustida ishlaydi.”

## 6. Data Preparation

Data Preparation `REAL EXECUTED`. Bu eng muhim bosqichlardan biri. Bu yerda data DWHga ketishidan oldin tekshiriladi va tayyorlanadi.

Bajariladigan ishlar:

- column profiling;
- type aniqlash;
- string trim qilish;
- bo'sh stringlarni `NULL`ga aylantirish;
- prepared draft version yaratish;
- manual correction qoidalarini qabul qilish;
- raw datani o'zgartirmasdan prepared version yaratish.

Muhim tushuncha:

```text
Raw data o'zgarmaydi.
Prepared data yangi version sifatida saqlanadi.
```

Tushuntirish matni:

“Bu bosqichda biz xom datani bevosita DWHga yubormaymiz. Avval uni profil qilamiz, bo'sh qiymatlarni aniqlaymiz, stringlarni tozalaymiz va prepared version yaratamiz. Raw object saqlanib qoladi, shuning uchun data lineage va audit buzilmaydi.”

## 7. Imputatsiya / Edit

Bu bosqich `REAL EXECUTED`. Demo aynan shu joyda to'xtashi kerak. Bu yerda rahbariyatga batafsil tushuntirish kerak.

Imputatsiya nima?

Imputatsiya - bo'sh yoki `null` qiymatlarni qoidaga asoslanib to'ldirish. Masalan:

- `brand=null` bo'lsa, column ichidagi eng ko'p uchragan brand bilan to'ldiriladi;
- `price=null` bo'lsa, numeric column bo'yicha o'rtacha qiymatga yaqin default hisoblanadi;
- `weight=null` bo'lsa, mavjud qiymatlar asosida default qo'yiladi;
- bo'sh stringlar avval `NULL`ga aylantiriladi, keyin to'ldiriladi.

Manual Edit nima?

Operator kerak bo'lsa recordni qo'lda tuzatadi. Masalan, bir recordning `brand`, `price` yoki `category` qiymatini qo'lda kiritadi. Bu tuzatish raw datani o'zgartirmaydi, faqat prepared versionga yoziladi.

Versionlash:

Har bir record uchun versionlar ko'rsatiladi:

```text
raw:v0 -> prep:v1 -> qa:v2 -> dwh:v3
```

Ma'nosi:

- `raw:v0` - manbadan kelgan asl record;
- `prep:v1` - preparation va imputationdan keyingi record;
- `qa:v2` - quality checkdan o'tadigan version;
- `dwh:v3` - Data Warehousega yuklanadigan version.

Tushuntirish matni:

“Demo shu joyda ataylab to'xtaydi. Sababi Data Warehousega sifatsiz yoki bo'sh qiymatli data ketmasligi kerak. Bu bosqichda null qiymatlar topiladi, hisoblangan qiymatlar bilan to'ldiriladi, operator kerak bo'lsa qo'lda edit qiladi. Keyin foydalanuvchi prepared versionni tanlaydi va faqat shundan keyin data quality bosqichiga o'tadi.”

## 8. Great Expectations

Great Expectations `REAL EXECUTED`. Bu data quality bosqichi.

Tekshiruvlar:

- record count borligi;
- primary key mavjudligi;
- schema bo'sh emasligi;
- null threshold normal ekanligi.

Tushuntirish matni:

“Bu bosqichda tayyorlangan data sifat nazoratidan o'tadi. Agar muhim fieldlar juda ko'p bo'sh bo'lsa yoki schema noto'g'ri bo'lsa, pipeline shu yerda to'xtashi mumkin. Bu DWHga noto'g'ri data ketishining oldini oladi.”

## 9. Apache Airflow

Airflow `AVAILABLE`. Productionda Airflow pipeline schedule va orchestration uchun ishlatiladi. Hozir demo'da pipeline frontend tugmasi orqali manual ishga tushyapti.

Tushuntirish matni:

“Production muhitda bu jarayonlar qo'lda emas, Airflow DAG orqali jadval asosida yoki event asosida ishga tushadi. Hozirgi demo'da jarayonni tushunarli qilish uchun frontenddan manual trigger qilyapmiz.”

## 10. PySpark

PySpark `REAL EXECUTED` deb ko'rsatiladi. Demo ichida Spark-compatible transform bosqichi ishlaydi. Bu bosqich prepared datani curated modelga aylantiradi.

Masalan product data quyidagi biznes fieldlarga o'tadi:

- `dw_id`
- `source_system`
- `source_entity`
- `entity_name`
- `category`
- `metric_name`
- `metric_value`
- `status`
- `loaded_at`

Tushuntirish matni:

“Bu bosqichda data analitik modelga o'tadi. Raw yoki prepared JSON endi biznesga kerakli columnlarga ajratiladi. Masalan mahsulot nomi, kategoriya, narx metric sifatida chiqariladi. Keyingi ClickHouse DWH aynan shu curated formatni qabul qiladi.”

## 11. Curated Zone

Curated Zone `REAL EXECUTED`. Bu yerda business-ready data saqlanadi. Raw datadan farqi: curated data standartlangan, dashboard va analytical query uchun tayyor bo'ladi.

Tushuntirish matni:

“Curated Zone - bu Data Lake ichidagi tozalangan va modelga solingan data qatlami. Bu qatlamdan keyin data DWHga yuklanadi yoki BI servislar undan foydalanadi.”

## 12. dbt

dbt `AVAILABLE`. Bu SQL transformatsiya va data modeling uchun. Demo run ichida dbt command real trigger qilinmagan, lekin arxitekturada model yaratish bosqichi sifatida ko'rsatilgan.

Tushuntirish matni:

“dbt productionda SQL transformatsiyalar, fact/dimension model va KPI calculation uchun ishlatiladi. Hozirgi demo'da transformatsiya backend kod ichida bajarilgan, dbt esa keyingi chuqurlashtirish uchun tayyor qatlam sifatida ko'rsatilgan.”

## 13. ClickHouse

ClickHouse `REAL EXECUTED`. Curated data ClickHouse warehouse tablega yuklanadi.

Bu yer Data Warehousening asosiy analytical bazasi sifatida ko'rsatiladi.

Tushuntirish matni:

“Bu bosqichda data Data Warehousega tushadi. ClickHouse katta hajmdagi analytical querylar, dashboardlar va KPI hisob-kitoblari uchun ishlatiladi. Demo'da curated rowlar ClickHousega insert qilinadi.”

## 14. PostgreSQL

PostgreSQL `REAL EXECUTED`. Bu ODS yoki metadata/audit saqlash uchun ishlatiladi.

Saqlanadigan ma'lumotlar:

- `run_id`
- `source`
- `mode`
- `status`
- `records`
- `quality_score`
- `warnings`

Tushuntirish matni:

“PostgreSQL bu yerda pipeline audit va operational metadata uchun ishlaydi. Har bir run bo'yicha qachon ishga tushgani, nechta record kelgani, quality score va warninglar yoziladi.”

## 15. Superset

Superset `NOT CONNECTED`. Arxitekturada BI dashboard uchun bor, lekin hozirgi demo'da Superset serverga ulanmagan. Hozir vizualizatsiya vazifasini Next.js frontend bajaryapti.

Tushuntirish matni:

“Superset dashboard qatlami sifatida rejalashtirilgan. Demo'da biz dashboardni o'z frontendimizda ko'rsatyapmiz. Shuning uchun Superset `NOT CONNECTED` deb halol ko'rsatilgan.”

## 16. Trino

Trino `NOT CONNECTED`. Trino distributed SQL query uchun kerak bo'ladi. Hozir pipeline ClickHouse va PostgreSQL orqali ishlayapti, Trino query yuborilmayapti.

Tushuntirish matni:

“Trino turli storage va database ustidan yagona SQL query qilish uchun kerak. Bu production integratsiya bosqichi. Hozirgi demo'da Trino ulanmagan.”

## 17. API Services

API Services `AVAILABLE`. Bu DWH yoki service datani boshqa tizimlarga API orqali berish qatlami. Hozir FastAPI backend bor, lekin alohida consumer-facing data API chuqur qilib ajratilmagan.

Tushuntirish matni:

“Bu qatlam orqali boshqa tizimlar tayyor data yoki KPIlarni API bilan olishi mumkin. Demo'da FastAPI mavjud, lekin bu alohida servis sifatida hali kengaytirilmagan.”

## 18. Portal

Portal `AVAILABLE`. Bu hozir ko'rib turgan Next.js web interface. Pipeline run, status, timeline, lineage va step explanation shu portalda ko'rsatiladi.

Tushuntirish matni:

“Portal foydalanuvchi uchun yagona oynadir. Operator yoki rahbariyat pipeline holatini, qaysi step ishlaganini, data qayerda to'xtaganini va natijani shu yerdan ko'radi.”

## 19. Export

Export `NOT CONNECTED`. CSV, Excel, PDF yoki JSON export alohida servis sifatida hali ulanmagan.

Tushuntirish matni:

“Export arxitekturada bor, lekin demo scope'da real download endpoint hali qo'shilmagan. Keyingi bosqichda prepared yoki curated datani CSV/Excel/PDF sifatida export qilish qo'shiladi.”

## Yakuniy hisobotni tushuntirish

Scenario tugagandan keyin yakuniy reportda quyidagilar ko'rsatiladi:

- records soni;
- quality score;
- umumiy runtime;
- warninglar;
- storage path;
- ClickHouse table;
- PostgreSQL audit;
- lineage preview.

Tushuntirish matni:

“Yakuniy hisobot bizga pipeline nechta record bilan ishlaganini, data quality qanchalik yaxshi ekanini, qaysi storage pathlarga yozilganini va DWHga nima yuklanganini ko'rsatadi. Bu monitoring va audit uchun muhim.”

## Data Lineage tushuntirish

Lineage bitta recordning butun yo'lini ko'rsatadi:

```text
Source API -> Raw -> Prepared -> Curated -> ClickHouse
```

Tushuntirish matni:

“Lineage orqali bitta record manbadan qanday kelganini, preparationda qanday o'zgarganini, curated modelga qanday aylanganini va warehousega qaysi key bilan tushganini kuzatamiz. Bu audit, xato topish va ishonchlilik uchun juda muhim.”

## Xulosa

Bu demo Data Warehouse jarayonining asosiy zanjirini ko'rsatadi:

```text
API -> Kafka -> Landing -> Raw -> Preparation -> Imputation/Edit -> Quality -> Transform -> Curated -> ClickHouse -> Audit
```

Asosiy gap:

“Biz data'ni manbadan olib darhol DWHga tashlamaymiz. Avval uni saqlaymiz, tekshiramiz, tozalaymiz, null qiymatlarni to'ldiramiz, kerak bo'lsa operator edit qiladi, version tanlanadi, quality checkdan o'tadi va shundan keyin DWHga yuklanadi. Shu sababli tizim boshqariladigan, audit qilinadigan va ishonchli Data Warehouse jarayonini ko'rsatadi.”
