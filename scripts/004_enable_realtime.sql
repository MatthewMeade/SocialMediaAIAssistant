-- Enable Realtime for posts table
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Enable Realtime for media table
ALTER PUBLICATION supabase_realtime ADD TABLE media;
