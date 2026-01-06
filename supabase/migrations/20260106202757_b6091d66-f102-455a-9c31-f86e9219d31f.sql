-- Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('spectator', 'admin', 'owner');

-- Create player_category enum
CREATE TYPE public.player_category AS ENUM ('platinum', 'gold', 'silver', 'emerging');

-- Create player_role enum
CREATE TYPE public.player_role AS ENUM ('batsman', 'bowler', 'all_rounder', 'wicket_keeper');

-- Create batting_hand enum
CREATE TYPE public.batting_hand AS ENUM ('left', 'right');

-- Create auction_status enum
CREATE TYPE public.auction_status AS ENUM ('pending', 'active', 'sold', 'unsold');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'spectator',
  UNIQUE (user_id, role)
);

-- Create owners table
CREATE TABLE public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  team_logo_url TEXT,
  total_points INTEGER NOT NULL DEFAULT 10000,
  remaining_points INTEGER NOT NULL DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create category_settings table for base prices
CREATE TABLE public.category_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category player_category NOT NULL UNIQUE,
  base_price INTEGER NOT NULL DEFAULT 100,
  min_required INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default category settings
INSERT INTO public.category_settings (category, base_price, min_required) VALUES
  ('platinum', 500, 2),
  ('gold', 300, 4),
  ('silver', 150, 3),
  ('emerging', 100, 2);

-- Create players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  nationality TEXT NOT NULL,
  profile_picture_url TEXT,
  category player_category NOT NULL,
  player_role player_role NOT NULL,
  batting_hand batting_hand NOT NULL DEFAULT 'right',
  total_matches INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  strike_rate DECIMAL(6,2) DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  bowling_average DECIMAL(6,2) DEFAULT 0,
  economy_rate DECIMAL(4,2) DEFAULT 0,
  best_bowling TEXT,
  auction_status auction_status DEFAULT 'pending',
  base_price INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create current_auction table (single row for active auction)
CREATE TABLE public.current_auction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  current_bid INTEGER NOT NULL DEFAULT 0,
  current_bidder_id UUID REFERENCES public.owners(id),
  is_active BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bids table for bid history
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES public.owners(id) ON DELETE CASCADE NOT NULL,
  bid_amount INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_players table (players bought by owners)
CREATE TABLE public.team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.owners(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  bought_price INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (player_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_auction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's owner id
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.owners WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Owners policies
CREATE POLICY "Anyone can view owners" ON public.owners FOR SELECT USING (true);
CREATE POLICY "Admins can manage owners" ON public.owners FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners can update own data" ON public.owners FOR UPDATE USING (auth.uid() = user_id);

-- Category settings policies
CREATE POLICY "Anyone can view category settings" ON public.category_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage category settings" ON public.category_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Players policies
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admins can manage players" ON public.players FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Current auction policies
CREATE POLICY "Anyone can view current auction" ON public.current_auction FOR SELECT USING (true);
CREATE POLICY "Admins can manage auction" ON public.current_auction FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners can update auction bids" ON public.current_auction FOR UPDATE USING (
  public.has_role(auth.uid(), 'owner')
);

-- Bids policies
CREATE POLICY "Anyone can view bids" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Owners can place bids" ON public.bids FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'owner') AND 
  owner_id = public.get_owner_id(auth.uid())
);

-- Team players policies
CREATE POLICY "Anyone can view team players" ON public.team_players FOR SELECT USING (true);
CREATE POLICY "Admins can manage team players" ON public.team_players FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'spectator');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for auction tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.current_auction;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;