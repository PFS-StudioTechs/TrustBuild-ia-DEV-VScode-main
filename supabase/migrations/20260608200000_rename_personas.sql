-- Rename agent personas: jarvis→alfred, robert_b→simone, auguste_p→gustave
UPDATE chat_messages SET persona = 'alfred'  WHERE persona = 'jarvis';
UPDATE chat_messages SET persona = 'simone'  WHERE persona = 'robert_b';
UPDATE chat_messages SET persona = 'gustave' WHERE persona = 'auguste_p';

UPDATE chat_conversations SET tags = array_replace(tags, 'jarvis',    'alfred')  WHERE 'jarvis'    = ANY(tags);
UPDATE chat_conversations SET tags = array_replace(tags, 'robert_b',  'simone')  WHERE 'robert_b'  = ANY(tags);
UPDATE chat_conversations SET tags = array_replace(tags, 'auguste_p', 'gustave') WHERE 'auguste_p' = ANY(tags);

ALTER TABLE chat_messages ALTER COLUMN persona SET DEFAULT 'alfred';
