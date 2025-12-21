-- Seed demo properties across NZ and AU
INSERT INTO public.properties (id, name, city, country, area, address, latitude, longitude, property_type, description, amenities, is_claimed, registration_status)
VALUES
  -- New Zealand
  ('11111111-1111-1111-1111-111111111101', 'The Wellington Grand', 'Wellington', 'NZ', 'CBD', '123 Lambton Quay, Wellington 6011', -41.2865, 174.7762, 'hotel', 'Luxury boutique hotel in the heart of Wellington with stunning harbour views.', ARRAY['wifi', 'breakfast', 'gym', 'restaurant', 'bar', 'room_service'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111102', 'Auckland Harbourside Inn', 'Auckland', 'NZ', 'Viaduct', '45 Princes Wharf, Auckland 1010', -36.8419, 174.7650, 'hotel', 'Modern waterfront hotel with easy access to Auckland attractions.', ARRAY['wifi', 'pool', 'gym', 'parking', 'restaurant'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111103', 'Queenstown Alpine Lodge', 'Queenstown', 'NZ', 'CBD', '78 Beach Street, Queenstown 9300', -45.0312, 168.6626, 'bnb', 'Cozy alpine retreat with mountain views and ski access.', ARRAY['wifi', 'fireplace', 'kitchen', 'parking', 'ski_storage'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111104', 'Rotorua Thermal Escape', 'Rotorua', 'NZ', 'Lakefront', '22 Lake Road, Rotorua 3010', -38.1368, 176.2497, 'resort', 'Relaxing resort with natural hot pools and spa treatments.', ARRAY['wifi', 'spa', 'pool', 'restaurant', 'hot_tub'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111105', 'Christchurch City Suites', 'Christchurch', 'NZ', 'CBD', '156 Victoria Street, Christchurch 8013', -43.5321, 172.6362, 'apartment', 'Modern apartments in the rebuilt Christchurch city center.', ARRAY['wifi', 'kitchen', 'laundry', 'parking', 'gym'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111106', 'Taupo Lakefront Motel', 'Taupo', 'NZ', 'Lakefront', '88 Lake Terrace, Taupo 3330', -38.6857, 176.0702, 'motel', 'Family-friendly motel with direct lake access and BBQ areas.', ARRAY['wifi', 'kitchen', 'bbq', 'parking', 'playground'], true, 'registered'),
  -- Australia
  ('11111111-1111-1111-1111-111111111107', 'Sydney Harbour Hotel', 'Sydney', 'AU', 'The Rocks', '99 George Street, The Rocks NSW 2000', -33.8568, 151.2093, 'hotel', 'Iconic hotel with Opera House and Harbour Bridge views.', ARRAY['wifi', 'pool', 'gym', 'restaurant', 'bar', 'spa'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111108', 'Melbourne Lanes Boutique', 'Melbourne', 'AU', 'CBD', '234 Flinders Lane, Melbourne VIC 3000', -37.8136, 144.9631, 'bnb', 'Boutique accommodation in Melbourne iconic laneway district.', ARRAY['wifi', 'breakfast', 'coffee', 'rooftop'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111109', 'Brisbane River Apartments', 'Brisbane', 'AU', 'South Bank', '56 Grey Street, South Brisbane QLD 4101', -27.4698, 153.0251, 'apartment', 'Riverside apartments near cultural precinct and restaurants.', ARRAY['wifi', 'pool', 'gym', 'kitchen', 'balcony'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111110', 'Gold Coast Beachfront Resort', 'Gold Coast', 'AU', 'Surfers Paradise', '100 The Esplanade, Surfers Paradise QLD 4217', -28.0027, 153.4310, 'resort', 'Beachfront resort with surf lessons and beach access.', ARRAY['wifi', 'pool', 'beach_access', 'restaurant', 'bar', 'kids_club'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111111', 'Perth City Hostel', 'Perth', 'AU', 'Northbridge', '189 William Street, Perth WA 6000', -31.9505, 115.8605, 'hostel', 'Budget-friendly hostel with rooftop bar and social events.', ARRAY['wifi', 'kitchen', 'laundry', 'rooftop_bar', 'lockers'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111112', 'Cairns Tropical Retreat', 'Cairns', 'AU', 'CBD', '67 Abbott Street, Cairns QLD 4870', -16.9186, 145.7781, 'hotel', 'Gateway to the Great Barrier Reef with tropical gardens.', ARRAY['wifi', 'pool', 'restaurant', 'tour_desk', 'dive_shop'], true, 'registered')
ON CONFLICT (id) DO NOTHING;

-- Seed rooms for each property
INSERT INTO public.rooms (id, property_id, name, description, max_adults, max_children, bed_configuration, amenities)
VALUES
  -- Wellington Grand rooms
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Harbour View Studio', 'Compact studio with harbour views', 2, 0, 'Queen bed', ARRAY['wifi', 'tv', 'minibar', 'safe']),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Deluxe King Suite', 'Spacious suite with separate living area', 2, 2, 'King bed', ARRAY['wifi', 'tv', 'minibar', 'safe', 'bathtub']),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'Twin Room', 'Classic twin room for friends or colleagues', 2, 0, '2 Single beds', ARRAY['wifi', 'tv', 'desk']),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 'Family Suite', 'Large suite perfect for families', 2, 3, 'King + 2 Singles', ARRAY['wifi', 'tv', 'kitchenette', 'washer']),
  -- Auckland Harbourside rooms
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111102', 'Standard Queen', 'Comfortable queen room with city views', 2, 1, 'Queen bed', ARRAY['wifi', 'tv', 'coffee']),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', 'Premium King', 'Premium room with harbour glimpses', 2, 1, 'King bed', ARRAY['wifi', 'tv', 'minibar', 'balcony']),
  ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111102', 'Executive Suite', 'Top floor suite with panoramic views', 2, 2, 'King bed + Sofa', ARRAY['wifi', 'tv', 'minibar', 'lounge', 'bathtub']),
  -- Queenstown Alpine rooms
  ('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111103', 'Cozy Studio', 'Warm studio with mountain views', 2, 0, 'Queen bed', ARRAY['wifi', 'heating', 'kitchenette']),
  ('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111103', 'Alpine Queen', 'Romantic room with fireplace', 2, 0, 'Queen bed', ARRAY['wifi', 'fireplace', 'bathtub']),
  ('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111103', 'Family Chalet', 'Spacious chalet for families', 2, 3, 'King + Bunk beds', ARRAY['wifi', 'kitchen', 'fireplace', 'ski_storage']),
  -- Rotorua Thermal rooms
  ('22222222-2222-2222-2222-222222222211', '11111111-1111-1111-1111-111111111104', 'Garden View Room', 'Peaceful room overlooking gardens', 2, 1, 'Queen bed', ARRAY['wifi', 'tv', 'hot_tub_access']),
  ('22222222-2222-2222-2222-222222222212', '11111111-1111-1111-1111-111111111104', 'Thermal Suite', 'Suite with private hot tub', 2, 0, 'King bed', ARRAY['wifi', 'tv', 'private_hot_tub', 'balcony']),
  ('22222222-2222-2222-2222-222222222213', '11111111-1111-1111-1111-111111111104', 'Lakefront Villa', 'Luxury villa with lake views', 4, 2, '2 King beds', ARRAY['wifi', 'kitchen', 'private_pool', 'bbq']),
  -- Christchurch Suites rooms
  ('22222222-2222-2222-2222-222222222214', '11111111-1111-1111-1111-111111111105', '1BR Apartment', 'Modern one bedroom apartment', 2, 1, 'Queen bed', ARRAY['wifi', 'kitchen', 'laundry', 'parking']),
  ('22222222-2222-2222-2222-222222222215', '11111111-1111-1111-1111-111111111105', '2BR Apartment', 'Spacious two bedroom apartment', 4, 2, 'King + Twin', ARRAY['wifi', 'kitchen', 'laundry', 'parking', 'balcony']),
  ('22222222-2222-2222-2222-222222222216', '11111111-1111-1111-1111-111111111105', 'Studio Apartment', 'Compact studio for solo travelers', 2, 0, 'Double bed', ARRAY['wifi', 'kitchenette']),
  -- Taupo Motel rooms
  ('22222222-2222-2222-2222-222222222217', '11111111-1111-1111-1111-111111111106', 'Lake View Unit', 'Unit with stunning lake views', 2, 2, 'Queen + Single', ARRAY['wifi', 'kitchen', 'bbq']),
  ('22222222-2222-2222-2222-222222222218', '11111111-1111-1111-1111-111111111106', 'Family Unit', 'Large unit for families', 2, 4, 'Queen + 2 Bunks', ARRAY['wifi', 'kitchen', 'bbq', 'playground_access']),
  ('22222222-2222-2222-2222-222222222219', '11111111-1111-1111-1111-111111111106', 'Budget Double', 'Affordable double room', 2, 0, 'Double bed', ARRAY['wifi', 'tv']),
  -- Sydney Harbour rooms
  ('22222222-2222-2222-2222-222222222220', '11111111-1111-1111-1111-111111111107', 'Opera View Room', 'Room with Opera House views', 2, 0, 'King bed', ARRAY['wifi', 'tv', 'minibar', 'balcony']),
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111107', 'Bridge View Suite', 'Suite facing Harbour Bridge', 2, 2, 'King + Sofa', ARRAY['wifi', 'tv', 'minibar', 'lounge', 'bathtub']),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111107', 'Standard Twin', 'Comfortable twin room', 2, 0, '2 Single beds', ARRAY['wifi', 'tv', 'coffee']),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111107', 'Penthouse Suite', 'Luxury penthouse with 360 views', 4, 2, '2 King beds', ARRAY['wifi', 'tv', 'minibar', 'lounge', 'private_terrace', 'butler']),
  -- Melbourne Lanes rooms
  ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111108', 'Laneway Room', 'Cozy room with laneway views', 2, 0, 'Queen bed', ARRAY['wifi', 'coffee', 'breakfast']),
  ('22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111108', 'Rooftop Loft', 'Loft with rooftop access', 2, 0, 'King bed', ARRAY['wifi', 'coffee', 'breakfast', 'rooftop_access']),
  ('22222222-2222-2222-2222-222222222226', '11111111-1111-1111-1111-111111111108', 'Artist Suite', 'Artistically decorated suite', 2, 1, 'Queen + Sofa', ARRAY['wifi', 'coffee', 'breakfast', 'art_supplies']),
  -- Brisbane River rooms
  ('22222222-2222-2222-2222-222222222227', '11111111-1111-1111-1111-111111111109', '1BR River View', 'One bedroom with river views', 2, 1, 'Queen bed', ARRAY['wifi', 'kitchen', 'balcony', 'pool_access']),
  ('22222222-2222-2222-2222-222222222228', '11111111-1111-1111-1111-111111111109', '2BR Penthouse', 'Two bedroom penthouse apartment', 4, 2, '2 Queen beds', ARRAY['wifi', 'kitchen', 'balcony', 'pool_access', 'gym_access']),
  ('22222222-2222-2222-2222-222222222229', '11111111-1111-1111-1111-111111111109', 'Studio', 'Compact riverside studio', 2, 0, 'Double bed', ARRAY['wifi', 'kitchenette', 'pool_access']),
  -- Gold Coast Resort rooms
  ('22222222-2222-2222-2222-222222222230', '11111111-1111-1111-1111-111111111110', 'Ocean View Room', 'Room with stunning ocean views', 2, 1, 'King bed', ARRAY['wifi', 'tv', 'beach_access']),
  ('22222222-2222-2222-2222-222222222231', '11111111-1111-1111-1111-111111111110', 'Beach Suite', 'Suite with direct beach access', 2, 2, 'King + Sofa', ARRAY['wifi', 'tv', 'beach_access', 'balcony']),
  ('22222222-2222-2222-2222-222222222232', '11111111-1111-1111-1111-111111111110', 'Family Cabana', 'Beachfront cabana for families', 4, 4, '2 Queen + Bunks', ARRAY['wifi', 'kitchen', 'beach_access', 'bbq', 'kids_pool']),
  ('22222222-2222-2222-2222-222222222233', '11111111-1111-1111-1111-111111111110', 'Surf Studio', 'Budget room for surfers', 2, 0, 'Double bed', ARRAY['wifi', 'surfboard_storage']),
  -- Perth Hostel rooms
  ('22222222-2222-2222-2222-222222222234', '11111111-1111-1111-1111-111111111111', 'Private Double', 'Private room with double bed', 2, 0, 'Double bed', ARRAY['wifi', 'locker']),
  ('22222222-2222-2222-2222-222222222235', '11111111-1111-1111-1111-111111111111', 'Private Twin', 'Private room with twin beds', 2, 0, '2 Single beds', ARRAY['wifi', 'locker']),
  ('22222222-2222-2222-2222-222222222236', '11111111-1111-1111-1111-111111111111', '4-Bed Dorm', 'Shared dorm with 4 beds', 4, 0, '4 Bunk beds', ARRAY['wifi', 'locker', 'reading_light']),
  -- Cairns Tropical rooms
  ('22222222-2222-2222-2222-222222222237', '11111111-1111-1111-1111-111111111112', 'Garden Room', 'Room overlooking tropical gardens', 2, 1, 'Queen bed', ARRAY['wifi', 'tv', 'pool_access']),
  ('22222222-2222-2222-2222-222222222238', '11111111-1111-1111-1111-111111111112', 'Reef Suite', 'Suite with reef tour packages', 2, 2, 'King + Sofa', ARRAY['wifi', 'tv', 'pool_access', 'reef_tour_desk']),
  ('22222222-2222-2222-2222-222222222239', '11111111-1111-1111-1111-111111111112', 'Tropical Villa', 'Private villa with plunge pool', 4, 2, '2 King beds', ARRAY['wifi', 'kitchen', 'private_pool', 'bbq'])
ON CONFLICT (id) DO NOTHING;