-- Migration: Add address normalization support for danger reports
-- Run this in your Supabase SQL editor or via supabase db push

BEGIN;

-- Ensure the shared updated_at trigger helper exists so master tables stay fresh
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Administrative area master tables -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.address_prefectures (
  code smallint PRIMARY KEY,
  name_ja text NOT NULL,
  name_kana text NOT NULL,
  name_en text NOT NULL,
  region text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER address_prefectures_set_updated_at
  BEFORE UPDATE ON public.address_prefectures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.address_prefectures (code, name_ja, name_kana, name_en, region)
VALUES
  (1, '北海道', 'ホッカイドウ', 'Hokkaido', 'Hokkaido'),
  (2, '青森県', 'アオモリケン', 'Aomori', 'Tohoku'),
  (3, '岩手県', 'イワテケン', 'Iwate', 'Tohoku'),
  (4, '宮城県', 'ミヤギケン', 'Miyagi', 'Tohoku'),
  (5, '秋田県', 'アキタケン', 'Akita', 'Tohoku'),
  (6, '山形県', 'ヤマガタケン', 'Yamagata', 'Tohoku'),
  (7, '福島県', 'フクシマケン', 'Fukushima', 'Tohoku'),
  (8, '茨城県', 'イバラキケン', 'Ibaraki', 'Kanto'),
  (9, '栃木県', 'トチギケン', 'Tochigi', 'Kanto'),
  (10, '群馬県', 'グンマケン', 'Gunma', 'Kanto'),
  (11, '埼玉県', 'サイタマケン', 'Saitama', 'Kanto'),
  (12, '千葉県', 'チバケン', 'Chiba', 'Kanto'),
  (13, '東京都', 'トウキョウト', 'Tokyo', 'Kanto'),
  (14, '神奈川県', 'カナガワケン', 'Kanagawa', 'Kanto'),
  (15, '新潟県', 'ニイガタケン', 'Niigata', 'Chubu'),
  (16, '富山県', 'トヤマケン', 'Toyama', 'Chubu'),
  (17, '石川県', 'イシカワケン', 'Ishikawa', 'Chubu'),
  (18, '福井県', 'フクイケン', 'Fukui', 'Chubu'),
  (19, '山梨県', 'ヤマナシケン', 'Yamanashi', 'Chubu'),
  (20, '長野県', 'ナガノケン', 'Nagano', 'Chubu'),
  (21, '岐阜県', 'ギフケン', 'Gifu', 'Chubu'),
  (22, '静岡県', 'シズオカケン', 'Shizuoka', 'Chubu'),
  (23, '愛知県', 'アイチケン', 'Aichi', 'Chubu'),
  (24, '三重県', 'ミエケン', 'Mie', 'Kansai'),
  (25, '滋賀県', 'シガケン', 'Shiga', 'Kansai'),
  (26, '京都府', 'キョウトフ', 'Kyoto', 'Kansai'),
  (27, '大阪府', 'オオサカフ', 'Osaka', 'Kansai'),
  (28, '兵庫県', 'ヒョウゴケン', 'Hyogo', 'Kansai'),
  (29, '奈良県', 'ナラケン', 'Nara', 'Kansai'),
  (30, '和歌山県', 'ワカヤマケン', 'Wakayama', 'Kansai'),
  (31, '鳥取県', 'トットリケン', 'Tottori', 'Chugoku'),
  (32, '島根県', 'シマネケン', 'Shimane', 'Chugoku'),
  (33, '岡山県', 'オカヤマケン', 'Okayama', 'Chugoku'),
  (34, '広島県', 'ヒロシマケン', 'Hiroshima', 'Chugoku'),
  (35, '山口県', 'ヤマグチケン', 'Yamaguchi', 'Chugoku'),
  (36, '徳島県', 'トクシマケン', 'Tokushima', 'Shikoku'),
  (37, '香川県', 'カガワケン', 'Kagawa', 'Shikoku'),
  (38, '愛媛県', 'エヒメケン', 'Ehime', 'Shikoku'),
  (39, '高知県', 'コウチケン', 'Kochi', 'Shikoku'),
  (40, '福岡県', 'フクオカケン', 'Fukuoka', 'Kyushu-Okinawa'),
  (41, '佐賀県', 'サガケン', 'Saga', 'Kyushu-Okinawa'),
  (42, '長崎県', 'ナガサキケン', 'Nagasaki', 'Kyushu-Okinawa'),
  (43, '熊本県', 'クマモトケン', 'Kumamoto', 'Kyushu-Okinawa'),
  (44, '大分県', 'オオイタケン', 'Oita', 'Kyushu-Okinawa'),
  (45, '宮崎県', 'ミヤザキケン', 'Miyazaki', 'Kyushu-Okinawa'),
  (46, '鹿児島県', 'カゴシマケン', 'Kagoshima', 'Kyushu-Okinawa'),
  (47, '沖縄県', 'オキナワケン', 'Okinawa', 'Kyushu-Okinawa')
ON CONFLICT (code) DO UPDATE
SET name_ja = EXCLUDED.name_ja,
    name_kana = EXCLUDED.name_kana,
    name_en = EXCLUDED.name_en,
    region = EXCLUDED.region,
    updated_at = timezone('utc', now());

CREATE TABLE IF NOT EXISTS public.address_municipalities (
  municipality_code text PRIMARY KEY CHECK (municipality_code ~ '^[0-9]{5}$'),
  prefecture_code smallint NOT NULL REFERENCES public.address_prefectures (code) ON DELETE CASCADE,
  name_ja text NOT NULL,
  name_kana text,
  name_en text NOT NULL,
  is_designated_city boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS address_municipalities_prefecture_name_idx
  ON public.address_municipalities (prefecture_code, name_ja);

CREATE INDEX IF NOT EXISTS address_municipalities_name_kana_idx
  ON public.address_municipalities (name_kana);

CREATE TRIGGER address_municipalities_set_updated_at
  BEFORE UPDATE ON public.address_municipalities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.address_municipalities (municipality_code, prefecture_code, name_ja, name_kana, name_en, is_designated_city)
VALUES
  ('01100', 1, '札幌市', 'サッポロシ', 'Sapporo', true),
  ('02201', 2, '青森市', 'アオモリシ', 'Aomori', false),
  ('03201', 3, '盛岡市', 'モリオカシ', 'Morioka', false),
  ('04100', 4, '仙台市', 'センダイシ', 'Sendai', true),
  ('05201', 5, '秋田市', 'アキタシ', 'Akita', false),
  ('06201', 6, '山形市', 'ヤマガタシ', 'Yamagata', false),
  ('07201', 7, '福島市', 'フクシマシ', 'Fukushima', false),
  ('08201', 8, '水戸市', 'ミトシ', 'Mito', false),
  ('09201', 9, '宇都宮市', 'ウツノミヤシ', 'Utsunomiya', false),
  ('10201', 10, '前橋市', 'マエバシシ', 'Maebashi', false),
  ('11100', 11, 'さいたま市', 'サイタマシ', 'Saitama', true),
  ('12100', 12, '千葉市', 'チバシ', 'Chiba', true),
  ('13104', 13, '新宿区', 'シンジュクク', 'Shinjuku', false),
  ('14100', 14, '横浜市', 'ヨコハマシ', 'Yokohama', true),
  ('15100', 15, '新潟市', 'ニイガタシ', 'Niigata', true),
  ('16201', 16, '富山市', 'トヤマシ', 'Toyama', false),
  ('17201', 17, '金沢市', 'カナザワシ', 'Kanazawa', false),
  ('18201', 18, '福井市', 'フクイシ', 'Fukui', false),
  ('19201', 19, '甲府市', 'コウフシ', 'Kofu', false),
  ('20201', 20, '長野市', 'ナガノシ', 'Nagano', false),
  ('21201', 21, '岐阜市', 'ギフシ', 'Gifu', false),
  ('22100', 22, '静岡市', 'シズオカシ', 'Shizuoka', true),
  ('23100', 23, '名古屋市', 'ナゴヤシ', 'Nagoya', true),
  ('24201', 24, '津市', 'ツシ', 'Tsu', false),
  ('25201', 25, '大津市', 'オオツシ', 'Otsu', false),
  ('26100', 26, '京都市', 'キョウトシ', 'Kyoto', true),
  ('27100', 27, '大阪市', 'オオサカシ', 'Osaka', true),
  ('28100', 28, '神戸市', 'コウベシ', 'Kobe', true),
  ('29201', 29, '奈良市', 'ナラシ', 'Nara', false),
  ('30201', 30, '和歌山市', 'ワカヤマシ', 'Wakayama', false),
  ('31201', 31, '鳥取市', 'トットリシ', 'Tottori', false),
  ('32201', 32, '松江市', 'マツエシ', 'Matsue', false),
  ('33100', 33, '岡山市', 'オカヤマシ', 'Okayama', false),
  ('34100', 34, '広島市', 'ヒロシマシ', 'Hiroshima', true),
  ('35203', 35, '山口市', 'ヤマグチシ', 'Yamaguchi', false),
  ('36201', 36, '徳島市', 'トクシマシ', 'Tokushima', false),
  ('37201', 37, '高松市', 'タカマツシ', 'Takamatsu', false),
  ('38201', 38, '松山市', 'マツヤマシ', 'Matsuyama', false),
  ('39201', 39, '高知市', 'コウチシ', 'Kochi', false),
  ('40130', 40, '福岡市', 'フクオカシ', 'Fukuoka', true),
  ('41201', 41, '佐賀市', 'サガシ', 'Saga', false),
  ('42201', 42, '長崎市', 'ナガサキシ', 'Nagasaki', false),
  ('43100', 43, '熊本市', 'クマモトシ', 'Kumamoto', true),
  ('44201', 44, '大分市', 'オオイタシ', 'Oita', false),
  ('45201', 45, '宮崎市', 'ミヤザキシ', 'Miyazaki', false),
  ('46201', 46, '鹿児島市', 'カゴシマシ', 'Kagoshima', false),
  ('47201', 47, '那覇市', 'ナハシ', 'Naha', false)
ON CONFLICT (municipality_code) DO UPDATE
SET prefecture_code = EXCLUDED.prefecture_code,
    name_ja = EXCLUDED.name_ja,
    name_kana = EXCLUDED.name_kana,
    name_en = EXCLUDED.name_en,
    is_designated_city = EXCLUDED.is_designated_city,
    updated_at = timezone('utc', now());

-- 2. Extend danger_reports --------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.geocode_provider AS ENUM ('mapbox', 'gsi', 'osm', 'manual', 'batch');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.danger_reports
  ADD COLUMN IF NOT EXISTS prefecture text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS geocode_source public.geocode_provider,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_confidence numeric(3, 2),
  ADD COLUMN IF NOT EXISTS prefecture_code smallint,
  ADD COLUMN IF NOT EXISTS municipality_code text,
  ADD COLUMN IF NOT EXISTS address_hash text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'danger_reports_prefecture_code_fkey'
  ) THEN
    ALTER TABLE public.danger_reports
      ADD CONSTRAINT danger_reports_prefecture_code_fkey
      FOREIGN KEY (prefecture_code) REFERENCES public.address_prefectures (code);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'danger_reports_municipality_code_fkey'
  ) THEN
    ALTER TABLE public.danger_reports
      ADD CONSTRAINT danger_reports_municipality_code_fkey
      FOREIGN KEY (municipality_code) REFERENCES public.address_municipalities (municipality_code);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'danger_reports_geocode_confidence_range'
  ) THEN
    ALTER TABLE public.danger_reports
      ADD CONSTRAINT danger_reports_geocode_confidence_range
      CHECK (geocode_confidence IS NULL OR (geocode_confidence >= 0 AND geocode_confidence <= 1));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS danger_reports_prefecture_city_idx
  ON public.danger_reports (prefecture_code, municipality_code);

CREATE INDEX IF NOT EXISTS danger_reports_prefecture_city_text_idx
  ON public.danger_reports (prefecture, city);

CREATE INDEX IF NOT EXISTS danger_reports_geocoded_at_idx
  ON public.danger_reports (geocoded_at DESC);

CREATE INDEX IF NOT EXISTS danger_reports_address_hash_idx
  ON public.danger_reports (address_hash);

COMMIT;


