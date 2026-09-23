DO $$ BEGIN RAISE EXCEPTION 'debug: current_user=%, session_user=%', current_user, session_user; END $$;
