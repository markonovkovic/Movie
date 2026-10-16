'use strict';

// Built-in catalogue so the app works offline with zero configuration.
// Set TMDB_API_KEY to recommend from The Movie Database's full catalogue instead.
// Fields: [title, year, genres, director, rating (IMDb-style, approx.), description]
const RAW = [
  // Comedy
  ['The Grand Budapest Hotel', 2014, ['Comedy', 'Adventure', 'Crime'], 'Wes Anderson', 8.1, 'A legendary concierge and his lobby boy are swept up in the theft of a priceless painting.'],
  ['Superbad', 2007, ['Comedy'], 'Greg Mottola', 7.6, 'Two co-dependent high-school friends try to score alcohol for a party before graduation.'],
  ['The Intouchables', 2011, ['Comedy', 'Drama'], 'Olivier Nakache, Éric Toledano', 8.5, 'A wealthy quadriplegic hires an unlikely caretaker from the projects, and a friendship blooms.'],
  ['Groundhog Day', 1993, ['Comedy', 'Romance', 'Fantasy'], 'Harold Ramis', 8.0, 'A cynical weatherman relives the same day over and over again.'],
  ['The Big Lebowski', 1998, ['Comedy', 'Crime'], 'Joel Coen', 8.1, 'The Dude is mistaken for a millionaire and dragged into a bizarre kidnapping plot.'],
  ['Hot Fuzz', 2007, ['Comedy', 'Action', 'Mystery'], 'Edgar Wright', 7.8, 'A top London cop is reassigned to a sleepy village hiding sinister secrets.'],
  ['Shaun of the Dead', 2004, ['Comedy', 'Horror'], 'Edgar Wright', 7.9, 'A slacker tries to win back his ex and save his mum during a zombie apocalypse.'],
  ['Ferris Bueller\'s Day Off', 1986, ['Comedy'], 'John Hughes', 7.8, 'A charismatic teen skips school for an unforgettable day in Chicago.'],
  ['Little Miss Sunshine', 2006, ['Comedy', 'Drama'], 'Jonathan Dayton, Valerie Faris', 7.8, 'A dysfunctional family road-trips in a yellow VW bus to a kids\' beauty pageant.'],
  ['Paddington 2', 2017, ['Comedy', 'Family', 'Adventure'], 'Paul King', 7.8, 'Paddington is framed for theft and must clear his name from prison.'],
  ['Mrs. Doubtfire', 1993, ['Comedy', 'Family', 'Drama'], 'Chris Columbus', 7.1, 'A divorced father disguises himself as a nanny to spend time with his kids.'],
  ['Jojo Rabbit', 2019, ['Comedy', 'Drama', 'War'], 'Taika Waititi', 7.9, 'A lonely German boy\'s imaginary friend is Hitler, until he discovers a girl hidden in his attic.'],
  ['Game Night', 2018, ['Comedy', 'Crime', 'Mystery'], 'John Francis Daley, Jonathan Goldstein', 6.9, 'A couples\' game night turns into a real kidnapping mystery.'],
  ['The Nice Guys', 2016, ['Comedy', 'Crime', 'Action'], 'Shane Black', 7.4, 'A hired enforcer and a hapless PI investigate a missing girl in 1970s LA.'],
  ['Booksmart', 2019, ['Comedy'], 'Olivia Wilde', 7.1, 'Two academic overachievers try to cram four years of fun into one night.'],

  // Drama
  ['The Shawshank Redemption', 1994, ['Drama'], 'Frank Darabont', 9.3, 'Two imprisoned men bond over years, finding solace and redemption through acts of decency.'],
  ['Forrest Gump', 1994, ['Drama', 'Romance'], 'Robert Zemeckis', 8.8, 'A kind-hearted man witnesses and influences decades of American history.'],
  ['Good Will Hunting', 1997, ['Drama', 'Romance'], 'Gus Van Sant', 8.3, 'A janitor with a genius-level IQ confronts his past with the help of a therapist.'],
  ['Dead Poets Society', 1989, ['Drama'], 'Peter Weir', 8.1, 'An unconventional English teacher inspires his students to seize the day.'],
  ['The Pursuit of Happyness', 2006, ['Drama', 'Biography'], 'Gabriele Muccino', 8.0, 'A struggling salesman and his son face homelessness while he chases a brokerage career.'],
  ['Manchester by the Sea', 2016, ['Drama'], 'Kenneth Lonergan', 7.8, 'A grieving loner returns home to care for his teenage nephew.'],
  ['Schindler\'s List', 1993, ['Drama', 'History', 'War'], 'Steven Spielberg', 9.0, 'A German industrialist saves more than a thousand Jewish refugees during the Holocaust.'],
  ['The Green Mile', 1999, ['Drama', 'Fantasy', 'Crime'], 'Frank Darabont', 8.6, 'A death-row guard discovers one of his prisoners has a miraculous gift.'],
  ['Whiplash', 2014, ['Drama', 'Music'], 'Damien Chazelle', 8.5, 'A young drummer is pushed to the brink by a ruthless music instructor.'],
  ['Rocky', 1976, ['Drama', 'Sport'], 'John G. Avildsen', 8.1, 'A small-time boxer gets a once-in-a-lifetime shot at the heavyweight title.'],
  ['The Social Network', 2010, ['Drama', 'Biography'], 'David Fincher', 7.8, 'The founding of Facebook and the lawsuits that followed.'],
  ['Moonlight', 2016, ['Drama'], 'Barry Jenkins', 7.4, 'Three chapters in the life of a young man growing up in Miami.'],
  ['Marriage Story', 2019, ['Drama', 'Romance'], 'Noah Baumbach', 7.9, 'A stage director and his actor wife struggle through a coast-to-coast divorce.'],
  ['Into the Wild', 2007, ['Drama', 'Adventure', 'Biography'], 'Sean Penn', 8.1, 'A graduate gives away his savings and hitchhikes into the Alaskan wilderness.'],
  ['The Truman Show', 1998, ['Drama', 'Comedy', 'Sci-Fi'], 'Peter Weir', 8.2, 'A man discovers his whole life is a reality TV show.'],
  ['Cinema Paradiso', 1988, ['Drama', 'Romance'], 'Giuseppe Tornatore', 8.5, 'A filmmaker recalls his childhood friendship with a small-town projectionist.'],
  ['Hidden Figures', 2016, ['Drama', 'Biography', 'History'], 'Theodore Melfi', 7.8, 'Three Black women mathematicians at NASA help launch John Glenn into orbit.'],
  ['Remember the Titans', 2000, ['Drama', 'Sport'], 'Boaz Yakin', 7.8, 'A newly integrated high-school football team learns to play together.'],
  ['The Help', 2011, ['Drama'], 'Tate Taylor', 8.1, 'A young writer shares the stories of Black maids in 1960s Mississippi.'],
  ['Room', 2015, ['Drama', 'Thriller'], 'Lenny Abrahamson', 8.1, 'A mother and her son escape captivity and face the outside world.'],

  // Romance
  ['Before Sunrise', 1995, ['Romance', 'Drama'], 'Richard Linklater', 8.1, 'Two strangers meet on a train and spend one night walking around Vienna.'],
  ['The Notebook', 2004, ['Romance', 'Drama'], 'Nick Cassavetes', 7.8, 'A poor young man and a rich young woman fall in love in 1940s South Carolina.'],
  ['Pride & Prejudice', 2005, ['Romance', 'Drama'], 'Joe Wright', 7.8, 'Elizabeth Bennet spars with the proud Mr. Darcy in Regency England.'],
  ['La La Land', 2016, ['Romance', 'Music', 'Comedy', 'Drama'], 'Damien Chazelle', 8.0, 'A jazz pianist and an aspiring actress fall in love while chasing their dreams in LA.'],
  ['When Harry Met Sally...', 1989, ['Romance', 'Comedy'], 'Rob Reiner', 7.7, 'Can men and women ever just be friends? Two New Yorkers spend years finding out.'],
  ['Notting Hill', 1999, ['Romance', 'Comedy'], 'Roger Michell', 7.2, 'A London bookshop owner falls for the world\'s biggest movie star.'],
  ['About Time', 2013, ['Romance', 'Comedy', 'Fantasy'], 'Richard Curtis', 7.8, 'A young man learns he can travel back in time and uses it to find love.'],
  ['Eternal Sunshine of the Spotless Mind', 2004, ['Romance', 'Drama', 'Sci-Fi'], 'Michel Gondry', 8.3, 'Estranged lovers undergo a procedure to erase each other from memory.'],
  ['Amélie', 2001, ['Romance', 'Comedy'], 'Jean-Pierre Jeunet', 8.3, 'A shy Parisian waitress secretly orchestrates the happiness of those around her.'],
  ['Crazy Rich Asians', 2018, ['Romance', 'Comedy'], 'Jon M. Chu', 6.9, 'A professor meets her boyfriend\'s ultra-wealthy family in Singapore.'],
  ['Titanic', 1997, ['Romance', 'Drama'], 'James Cameron', 7.9, 'A young aristocrat falls for a poor artist aboard the ill-fated ship.'],
  ['Her', 2013, ['Romance', 'Drama', 'Sci-Fi'], 'Spike Jonze', 8.0, 'A lonely writer develops a relationship with an AI operating system.'],
  ['Past Lives', 2023, ['Romance', 'Drama'], 'Celine Song', 7.8, 'Two childhood friends reunite in New York decades after being separated.'],
  ['10 Things I Hate About You', 1999, ['Romance', 'Comedy'], 'Gil Junger', 7.3, 'A new student is paid to date the most antisocial girl in school.'],

  // Action
  ['Mad Max: Fury Road', 2015, ['Action', 'Adventure', 'Sci-Fi'], 'George Miller', 8.1, 'A drifter and a rebel warrior flee a tyrant across a post-apocalyptic desert.'],
  ['The Dark Knight', 2008, ['Action', 'Crime', 'Drama'], 'Christopher Nolan', 9.0, 'Batman faces the Joker, an agent of chaos who plunges Gotham into anarchy.'],
  ['John Wick', 2014, ['Action', 'Thriller', 'Crime'], 'Chad Stahelski', 7.4, 'A retired hitman comes back for revenge after gangsters take everything from him.'],
  ['Die Hard', 1988, ['Action', 'Thriller'], 'John McTiernan', 8.2, 'A New York cop takes on terrorists in an LA skyscraper on Christmas Eve.'],
  ['Gladiator', 2000, ['Action', 'Adventure', 'Drama'], 'Ridley Scott', 8.5, 'A betrayed Roman general rises as a gladiator to avenge his family.'],
  ['Top Gun: Maverick', 2022, ['Action', 'Drama'], 'Joseph Kosinski', 8.2, 'Maverick trains elite pilots for a near-impossible mission.'],
  ['Mission: Impossible – Fallout', 2018, ['Action', 'Adventure', 'Thriller'], 'Christopher McQuarrie', 7.7, 'Ethan Hunt races against time after a mission goes wrong.'],
  ['Kill Bill: Vol. 1', 2003, ['Action', 'Crime', 'Thriller'], 'Quentin Tarantino', 8.2, 'A former assassin wakes from a coma and seeks vengeance.'],
  ['The Matrix', 1999, ['Action', 'Sci-Fi'], 'Lana & Lilly Wachowski', 8.7, 'A hacker learns reality is a simulation and joins the rebellion against the machines.'],
  ['Terminator 2: Judgment Day', 1991, ['Action', 'Sci-Fi'], 'James Cameron', 8.6, 'A reprogrammed cyborg protects a boy destined to lead humanity\'s resistance.'],
  ['Everything Everywhere All at Once', 2022, ['Action', 'Comedy', 'Sci-Fi', 'Adventure'], 'Daniel Kwan, Daniel Scheinert', 7.8, 'A laundromat owner must connect with parallel-universe versions of herself.'],
  ['Crouching Tiger, Hidden Dragon', 2000, ['Action', 'Adventure', 'Romance'], 'Ang Lee', 7.9, 'Two warriors pursue a stolen sword and a young noblewoman with secret skills.'],
  ['Baby Driver', 2017, ['Action', 'Crime', 'Music'], 'Edgar Wright', 7.5, 'A music-loving getaway driver is coerced into one last heist.'],

  // Adventure / Fantasy
  ['The Lord of the Rings: The Fellowship of the Ring', 2001, ['Adventure', 'Fantasy', 'Action'], 'Peter Jackson', 8.9, 'A hobbit sets out with eight companions to destroy a powerful ring.'],
  ['Indiana Jones and the Raiders of the Lost Ark', 1981, ['Adventure', 'Action'], 'Steven Spielberg', 8.4, 'An archaeologist races the Nazis to find the Ark of the Covenant.'],
  ['Jurassic Park', 1993, ['Adventure', 'Sci-Fi', 'Action'], 'Steven Spielberg', 8.2, 'A theme park of cloned dinosaurs breaks loose.'],
  ['Pirates of the Caribbean: The Curse of the Black Pearl', 2003, ['Adventure', 'Fantasy', 'Action'], 'Gore Verbinski', 8.1, 'A blacksmith teams up with an eccentric pirate to rescue a kidnapped governor\'s daughter.'],
  ['The Secret Life of Walter Mitty', 2013, ['Adventure', 'Comedy', 'Drama'], 'Ben Stiller', 7.3, 'A daydreaming photo manager embarks on a real global adventure.'],
  ['Harry Potter and the Sorcerer\'s Stone', 2001, ['Fantasy', 'Adventure', 'Family'], 'Chris Columbus', 7.6, 'An orphaned boy discovers he is a wizard and enrolls at Hogwarts.'],
  ['The Princess Bride', 1987, ['Fantasy', 'Adventure', 'Romance', 'Comedy'], 'Rob Reiner', 8.0, 'A farmhand-turned-pirate sets out to rescue his true love.'],
  ['Pan\'s Labyrinth', 2006, ['Fantasy', 'Drama', 'War'], 'Guillermo del Toro', 8.2, 'A girl escapes into an eerie fantasy world in post-Civil War Spain.'],
  ['Back to the Future', 1985, ['Adventure', 'Comedy', 'Sci-Fi'], 'Robert Zemeckis', 8.5, 'A teenager travels back to 1955 and must make sure his parents fall in love.'],
  ['Life of Pi', 2012, ['Adventure', 'Drama', 'Fantasy'], 'Ang Lee', 7.9, 'A young man survives at sea in a lifeboat with a Bengal tiger.'],

  // Sci-Fi
  ['Interstellar', 2014, ['Sci-Fi', 'Adventure', 'Drama'], 'Christopher Nolan', 8.7, 'Explorers travel through a wormhole in search of a new home for humanity.'],
  ['Inception', 2010, ['Sci-Fi', 'Action', 'Thriller'], 'Christopher Nolan', 8.8, 'A thief who steals secrets through dreams is tasked with planting an idea.'],
  ['Arrival', 2016, ['Sci-Fi', 'Drama', 'Mystery'], 'Denis Villeneuve', 7.9, 'A linguist is recruited to communicate with mysterious alien visitors.'],
  ['Blade Runner 2049', 2017, ['Sci-Fi', 'Drama', 'Mystery'], 'Denis Villeneuve', 8.0, 'A new blade runner unearths a secret that could plunge society into chaos.'],
  ['The Martian', 2015, ['Sci-Fi', 'Adventure', 'Comedy'], 'Ridley Scott', 8.0, 'An astronaut stranded on Mars must science his way to survival.'],
  ['Dune: Part One', 2021, ['Sci-Fi', 'Adventure', 'Drama'], 'Denis Villeneuve', 8.0, 'A noble family becomes embroiled in a war for a desert planet\'s precious spice.'],
  ['Star Wars: Episode IV – A New Hope', 1977, ['Sci-Fi', 'Adventure', 'Action'], 'George Lucas', 8.6, 'A farm boy joins a rebellion to rescue a princess and defeat the Empire.'],
  ['E.T. the Extra-Terrestrial', 1982, ['Sci-Fi', 'Family', 'Adventure'], 'Steven Spielberg', 7.9, 'A boy befriends a stranded alien and helps him get home.'],
  ['Ex Machina', 2014, ['Sci-Fi', 'Thriller', 'Drama'], 'Alex Garland', 7.7, 'A programmer evaluates the consciousness of a humanoid AI.'],
  ['Gattaca', 1997, ['Sci-Fi', 'Drama', 'Thriller'], 'Andrew Niccol', 7.8, 'A genetically "inferior" man assumes another\'s identity to reach space.'],

  // Thriller / Mystery / Crime
  ['Se7en', 1995, ['Thriller', 'Crime', 'Mystery'], 'David Fincher', 8.6, 'Two detectives hunt a serial killer who uses the seven deadly sins as motives.'],
  ['Gone Girl', 2014, ['Thriller', 'Mystery', 'Drama'], 'David Fincher', 8.1, 'A man becomes the prime suspect when his wife disappears.'],
  ['Knives Out', 2019, ['Mystery', 'Comedy', 'Crime'], 'Rian Johnson', 7.9, 'A detective investigates the death of a wealthy crime novelist.'],
  ['Parasite', 2019, ['Thriller', 'Drama'], 'Bong Joon Ho', 8.5, 'A poor family schemes its way into the household of a wealthy one.'],
  ['The Silence of the Lambs', 1991, ['Thriller', 'Crime', 'Horror'], 'Jonathan Demme', 8.6, 'An FBI trainee seeks help from an imprisoned cannibal to catch a killer.'],
  ['Shutter Island', 2010, ['Thriller', 'Mystery'], 'Martin Scorsese', 8.2, 'A U.S. Marshal investigates a disappearance at a psychiatric facility.'],
  ['Memento', 2000, ['Mystery', 'Thriller'], 'Christopher Nolan', 8.4, 'A man with short-term memory loss hunts for his wife\'s killer.'],
  ['Prisoners', 2013, ['Thriller', 'Crime', 'Drama'], 'Denis Villeneuve', 8.1, 'A father takes matters into his own hands when his daughter goes missing.'],
  ['Pulp Fiction', 1994, ['Crime', 'Drama'], 'Quentin Tarantino', 8.9, 'Interlocking tales of LA criminals, boxers and a mysterious briefcase.'],
  ['The Godfather', 1972, ['Crime', 'Drama'], 'Francis Ford Coppola', 9.2, 'The aging patriarch of a crime dynasty transfers control to his reluctant son.'],
  ['Ocean\'s Eleven', 2001, ['Crime', 'Thriller', 'Comedy'], 'Steven Soderbergh', 7.7, 'Danny Ocean assembles a crew to rob three Las Vegas casinos at once.'],
  ['The Usual Suspects', 1995, ['Crime', 'Mystery', 'Thriller'], 'Bryan Singer', 8.5, 'A survivor tells police how five criminals were brought together.'],
  ['Catch Me If You Can', 2002, ['Crime', 'Biography', 'Drama'], 'Steven Spielberg', 8.1, 'A young con artist forges millions while an FBI agent chases him.'],
  ['Zodiac', 2007, ['Mystery', 'Crime', 'Thriller'], 'David Fincher', 7.7, 'A cartoonist becomes obsessed with tracking down the Zodiac killer.'],

  // Horror
  ['Get Out', 2017, ['Horror', 'Mystery', 'Thriller'], 'Jordan Peele', 7.8, 'A young Black man uncovers a disturbing secret when visiting his girlfriend\'s parents.'],
  ['The Shining', 1980, ['Horror', 'Drama'], 'Stanley Kubrick', 8.4, 'A writer\'s sanity unravels as he winters with his family in an isolated hotel.'],
  ['A Quiet Place', 2018, ['Horror', 'Sci-Fi', 'Drama'], 'John Krasinski', 7.5, 'A family must live in silence to hide from creatures that hunt by sound.'],
  ['Hereditary', 2018, ['Horror', 'Drama', 'Mystery'], 'Ari Aster', 7.3, 'A grieving family is haunted by tragic and disturbing occurrences.'],
  ['The Conjuring', 2013, ['Horror', 'Mystery'], 'James Wan', 7.5, 'Paranormal investigators help a family terrorized by a dark presence.'],
  ['Alien', 1979, ['Horror', 'Sci-Fi'], 'Ridley Scott', 8.5, 'The crew of a commercial spaceship encounters a deadly lifeform.'],
  ['It Follows', 2014, ['Horror', 'Mystery'], 'David Robert Mitchell', 6.8, 'A young woman is pursued by a supernatural entity after a sexual encounter.'],
  ['Train to Busan', 2016, ['Horror', 'Action', 'Thriller'], 'Yeon Sang-ho', 7.6, 'Passengers fight for survival as a zombie outbreak spreads aboard a speeding train.'],

  // Animation / Family
  ['Spirited Away', 2001, ['Animation', 'Fantasy', 'Family'], 'Hayao Miyazaki', 8.6, 'A girl wanders into a world of spirits and must work to free her parents.'],
  ['Toy Story', 1995, ['Animation', 'Comedy', 'Family'], 'John Lasseter', 8.3, 'A cowboy doll feels threatened when a flashy space ranger becomes the favorite toy.'],
  ['Up', 2009, ['Animation', 'Adventure', 'Family'], 'Pete Docter', 8.3, 'A widower ties thousands of balloons to his house and flies to South America.'],
  ['Inside Out', 2015, ['Animation', 'Comedy', 'Family'], 'Pete Docter', 8.1, 'A girl\'s emotions navigate her move to a new city.'],
  ['Coco', 2017, ['Animation', 'Family', 'Music', 'Fantasy'], 'Lee Unkrich', 8.4, 'An aspiring musician journeys into the Land of the Dead.'],
  ['WALL·E', 2008, ['Animation', 'Sci-Fi', 'Family', 'Romance'], 'Andrew Stanton', 8.4, 'A lonely robot on an abandoned Earth falls in love.'],
  ['My Neighbor Totoro', 1988, ['Animation', 'Family', 'Fantasy'], 'Hayao Miyazaki', 8.1, 'Two sisters befriend gentle forest spirits in rural Japan.'],
  ['Spider-Man: Into the Spider-Verse', 2018, ['Animation', 'Action', 'Adventure'], 'Bob Persichetti, Peter Ramsey, Rodney Rothman', 8.4, 'Teen Miles Morales meets Spider-heroes from other dimensions.'],
  ['Finding Nemo', 2003, ['Animation', 'Adventure', 'Family'], 'Andrew Stanton', 8.2, 'A timid clownfish crosses the ocean to find his son.'],
  ['Shrek', 2001, ['Animation', 'Comedy', 'Family'], 'Andrew Adamson, Vicky Jenson', 7.9, 'An ogre goes on a quest to rescue a princess and reclaim his swamp.'],
  ['The Lion King', 1994, ['Animation', 'Drama', 'Family', 'Music'], 'Roger Allers, Rob Minkoff', 8.5, 'A lion cub flees after his father\'s death and must return to claim his throne.'],
  ['Ratatouille', 2007, ['Animation', 'Comedy', 'Family'], 'Brad Bird', 8.1, 'A rat who dreams of being a chef teams up with a kitchen boy in Paris.'],
  ['Soul', 2020, ['Animation', 'Comedy', 'Fantasy', 'Family'], 'Pete Docter', 8.0, 'A jazz musician\'s soul gets separated from his body before his big break.'],
  ['Paddington', 2014, ['Family', 'Comedy', 'Adventure'], 'Paul King', 7.3, 'A polite Peruvian bear arrives in London looking for a home.'],
  ['The Iron Giant', 1999, ['Animation', 'Sci-Fi', 'Family'], 'Brad Bird', 8.1, 'A boy befriends a giant robot that the government wants to destroy.'],

  // Music
  ['School of Rock', 2003, ['Music', 'Comedy', 'Family'], 'Richard Linklater', 7.2, 'A failed rocker poses as a substitute teacher and turns his class into a band.'],
  ['Bohemian Rhapsody', 2018, ['Music', 'Biography', 'Drama'], 'Bryan Singer', 7.9, 'The story of Queen and Freddie Mercury, culminating at Live Aid.'],
  ['Sing Street', 2016, ['Music', 'Comedy', 'Romance', 'Drama'], 'John Carney', 7.9, 'A boy in 1980s Dublin starts a band to impress a mysterious girl.'],
  ['Mamma Mia!', 2008, ['Music', 'Comedy', 'Romance'], 'Phyllida Lloyd', 6.5, 'A bride-to-be invites three possible fathers to her Greek island wedding.'],
  ['The Greatest Showman', 2017, ['Music', 'Drama', 'Biography'], 'Michael Gracey', 7.5, 'P.T. Barnum rises from nothing to create a spectacular show.'],

  // Documentary / History / War
  ['My Octopus Teacher', 2020, ['Documentary'], 'Pippa Ehrlich, James Reed', 8.1, 'A filmmaker forms an unusual friendship with an octopus in a kelp forest.'],
  ['Free Solo', 2018, ['Documentary', 'Adventure', 'Sport'], 'Jimmy Chin, Elizabeth Chai Vasarhelyi', 8.1, 'Alex Honnold attempts to climb El Capitan without ropes.'],
  ['Won\'t You Be My Neighbor?', 2018, ['Documentary', 'Biography'], 'Morgan Neville', 8.3, 'A look at the life and legacy of Fred Rogers.'],
  ['Jiro Dreams of Sushi', 2011, ['Documentary'], 'David Gelb', 7.8, 'An 85-year-old sushi master pursues perfection in a Tokyo subway restaurant.'],
  ['Saving Private Ryan', 1998, ['War', 'Drama'], 'Steven Spielberg', 8.6, 'A squad goes behind enemy lines to bring home a paratrooper.'],
  ['1917', 2019, ['War', 'Drama', 'Action'], 'Sam Mendes', 8.2, 'Two soldiers race across enemy territory to deliver a vital message.'],
  ['Dunkirk', 2017, ['War', 'History', 'Action'], 'Christopher Nolan', 7.8, 'Allied soldiers are evacuated from Dunkirk under heavy fire.'],
  ['Braveheart', 1995, ['History', 'War', 'Drama'], 'Mel Gibson', 8.3, 'William Wallace leads a Scottish revolt against the English king.'],
  ['Oppenheimer', 2023, ['History', 'Biography', 'Drama'], 'Christopher Nolan', 8.3, 'The story of the physicist behind the atomic bomb.'],

  // Sport / Western
  ['Moneyball', 2011, ['Sport', 'Biography', 'Drama'], 'Bennett Miller', 7.6, 'A baseball GM uses statistics to build a winning team on a tight budget.'],
  ['Ford v Ferrari', 2019, ['Sport', 'Action', 'Biography'], 'James Mangold', 8.1, 'Engineers and a driver build a race car to beat Ferrari at Le Mans.'],
  ['The Good, the Bad and the Ugly', 1966, ['Western', 'Adventure'], 'Sergio Leone', 8.8, 'Three gunslingers compete to find a fortune in buried Confederate gold.'],
  ['Django Unchained', 2012, ['Western', 'Drama', 'Action'], 'Quentin Tarantino', 8.5, 'A freed slave and a bounty hunter set out to rescue his wife.'],
  ['True Grit', 2010, ['Western', 'Drama', 'Adventure'], 'Joel & Ethan Coen', 7.6, 'A stubborn teenager hires a tough marshal to track her father\'s killer.'],
];

const MOVIES = RAW.map(([title, year, genres, director, rating, description], i) => ({
  id: i + 1,
  title,
  year,
  genres,
  director,
  rating,
  description,
}));

const GENRES = [...new Set(MOVIES.flatMap((m) => m.genres))].sort();

module.exports = { MOVIES, GENRES };
