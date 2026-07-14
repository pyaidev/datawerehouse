CREATE USER IF NOT EXISTS dwh IDENTIFIED WITH plaintext_password BY 'dwh';
GRANT ALL ON dwh.* TO dwh;
