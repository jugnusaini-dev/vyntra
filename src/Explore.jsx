import { useEffect, useMemo, useState } from "react";
import { Search, TrendingUp, Users, Compass, Heart, MessageCircle, Share2 } from "lucide-react";
import Navbar from "./navpage/Navbar";
import { api } from "./api";
import "./Explore.css";

const categories = ["All", "Photography", "Design", "Travel", "Lifestyle"];
const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80";

function Explore() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("For you");
  const [activeCategory, setActiveCategory] = useState("All");
  const [creators, setCreators] = useState([]);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedPost, setCopiedPost] = useState("");
  const [shareError, setShareError] = useState("");
  const [pendingFollows, setPendingFollows] = useState([]);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    api.getExplore(query.trim(), activeCategory)
      .then((result) => {
        if (!isActive) return;
        setCreators(result.creators);
        setTopics(result.topics);
        setFeaturedPosts(result.posts.map((post) => ({
          ...post,
          caption: post.content,
          creator: { name: post.name, handle: post.handle, avatar: post.avatar },
        })));
        setError("");
      })
      .catch((loadError) => {
        if (isActive) setError(loadError.message);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [query, activeCategory]);

  const normalizedQuery = query.trim().toLowerCase();
  const selectedTopic = topics.find(
    (topic) => topic.tag.toLowerCase() === normalizedQuery,
  );
  const filteredCreators = useMemo(
    () =>
      creators.filter((creator) => {
        const matchesCategory =
          activeCategory === "All" || creator.category === activeCategory;
        const matchesQuery =
          !normalizedQuery ||
          (selectedTopic &&
            (selectedTopic.category === "Community" ||
              creator.category === selectedTopic.category)) ||
          `${creator.name} ${creator.handle} ${creator.bio} ${creator.category}`
            .toLowerCase()
            .includes(normalizedQuery);
        return matchesCategory && matchesQuery;
      }),
    [activeCategory, creators, normalizedQuery, selectedTopic],
  );

  const filteredTopics = topics.filter((topic) => {
    const matchesCategory =
      activeCategory === "All" ||
      topic.category === activeCategory ||
      topic.category === "Community";
    const matchesQuery =
      !normalizedQuery ||
      `${topic.tag} ${topic.category}`.toLowerCase().includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  const filteredPosts = featuredPosts.filter((post) => {
    const matchesCategory =
      activeCategory === "All" || post.topic === activeCategory;
    const matchesQuery =
      !normalizedQuery ||
      (selectedTopic &&
        (selectedTopic.category === "Community" ||
          post.topic === selectedTopic.category)) ||
      `${post.caption} ${post.creator.name} ${post.creator.handle} ${post.topic}`
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  const toggleFollow = async (creator) => {
    if (pendingFollows.includes(creator.id)) return;
    setPendingFollows((current) => [...current, creator.id]);
    try {
      const following = !creator.following;
      await api.setFollow(creator.id, following);
      setCreators((current) =>
        current.map((item) => item.id === creator.id ? { ...item, following } : item),
      );
    } catch (followError) {
      setError(followError.message);
    } finally {
      setPendingFollows((current) => current.filter((id) => id !== creator.id));
    }
  };

  const toggleLike = async (post) => {
    try {
      const result = await api.setPostLike(post.id, !post.liked);
      setFeaturedPosts((current) =>
        current.map((item) => item.id === post.id ? {
          ...item,
          likes: result.post.likes,
          liked: result.post.liked,
        } : item),
      );
    } catch (likeError) {
      setError(likeError.message);
    }
  };

  const sharePost = async (postId) => {
    const url = `${window.location.origin}${window.location.pathname}#${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Explore Vyntra", url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopiedPost(postId);
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
      await api.sharePost(postId);
      setShareError("");
    } catch (error) {
      if (error.name !== "AbortError") {
        setShareError(error.message || "This post could not be shared.");
      }
    }
  };

  const selectTopic = (tag) => {
    setQuery(tag);
    setActiveTab("Trending");
  };

  const tabs = [
    { label: "For you", icon: Compass },
    { label: "Trending", icon: TrendingUp },
    { label: "People", icon: Users },
  ];

  return (
    <div className="explore-page">
      <Navbar />
      <main className="explore-layout">
        <header className="explore-hero">
          <div className="explore-hero-copy">
            <span className="explore-eyebrow">A WORLD OF IDEAS</span>
            <h1>Explore what moves you.</h1>
            <p>Find fresh perspectives, people, and little things worth sharing.</p>
          </div>
          <div className="explore-hero-art" aria-hidden="true">
            <span className="hero-orbit orbit-one" />
            <span className="hero-orbit orbit-two" />
            <span className="hero-star">✦</span>
            <span className="hero-spark">✧</span>
          </div>
        </header>

        <div className="explore-search" role="search">
          <Search size={19} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, topics, or ideas..."
            aria-label="Search people, topics, or ideas"
          />
          {query && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <nav className="explore-tabs" aria-label="Explore categories">
          {tabs.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              className={activeTab === label ? "active" : ""}
              onClick={() => setActiveTab(label)}
              aria-pressed={activeTab === label}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="explore-content">
          {isLoading && <p className="explore-status" role="status">Loading Explore...</p>}
          {error && <p className="explore-error" role="alert">{error}</p>}
          {activeTab !== "People" && (
            <section className="explore-section topics-section">
              <div className="explore-section-heading">
                <div>
                  <span className="section-kicker">THE CONVERSATION</span>
                  <h2>Trending topics</h2>
                </div>
                <span className="live-indicator"><i /> Happening now</span>
              </div>
              <div className="topic-grid">
                {filteredTopics.map((topic, index) => (
                  <button
                    type="button"
                    key={topic.tag}
                    className={`topic-card topic-${topic.color}`}
                    onClick={() => selectTopic(topic.tag)}
                  >
                    <span className="topic-number">0{index + 1}</span>
                    <span className="topic-mark" aria-hidden="true">#</span>
                    <strong>{topic.tag}</strong>
                    <span className="topic-meta">{topic.posts} <span>·</span> {topic.category}</span>
                    <span className="topic-open" aria-hidden="true">↗</span>
                  </button>
                ))}
                {filteredTopics.length === 0 && (
                  <p className="explore-empty">No topics found. Try another search.</p>
                )}
              </div>
            </section>
          )}

          {activeTab !== "Trending" && (
            <section className="explore-section people-section">
              <div className="explore-section-heading">
                <div>
                  <span className="section-kicker">GOOD PEOPLE, GOOD IDEAS</span>
                  <h2>Creators to know</h2>
                </div>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => setActiveTab("People")}
                >
                  See all <span>→</span>
                </button>
              </div>
              <div className="creator-grid">
                {filteredCreators.map((creator) => (
                  <article className="creator-card" key={creator.id}>
                    <img className="creator-avatar" src={creator.avatar || defaultAvatar} alt={creator.name} />
                    <span className="creator-category">{creator.category}</span>
                    <h3>{creator.name}</h3>
                    <span className="creator-handle">{creator.handle}</span>
                    <p>{creator.bio}</p>
                    <div className="creator-card-bottom">
                      <span>{creator.followers} <small>followers</small></span>
                      <button
                        type="button"
                        className={creator.following ? "following" : ""}
                        onClick={() => toggleFollow(creator)}
                        aria-pressed={creator.following}
                        disabled={pendingFollows.includes(creator.id)}
                      >
                        {creator.following ? "Following" : "Follow"}
                      </button>
                    </div>
                  </article>
                ))}
                {filteredCreators.length === 0 && (
                  <p className="explore-empty">No creators found. Try another search.</p>
                )}
              </div>
            </section>
          )}

          {activeTab !== "People" && (
            <section className="explore-section posts-section">
              <div className="explore-section-heading">
                <div>
                  <span className="section-kicker">FRESH FROM THE COMMUNITY</span>
                  <h2>Worth a look</h2>
                </div>
              </div>
              <div className="category-chips" aria-label="Filter by category">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={activeCategory === category ? "selected" : ""}
                    onClick={() => setActiveCategory(category)}
                    aria-pressed={activeCategory === category}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="featured-grid">
                {filteredPosts.map((post) => {
                  const liked = post.liked;
                  return (
                    <article className="featured-card" id={post.id} key={post.id}>
                      {post.image && (
                        <div className="featured-image-wrap">
                          <img src={post.image} alt={post.imageAlt} />
                          <span className="featured-topic">{post.topic}</span>
                        </div>
                      )}
                      <div className="featured-body">
                        <div className="featured-author">
                          <img src={post.creator.avatar || defaultAvatar} alt="" />
                          <div><strong>{post.creator.name}</strong><span>{post.creator.handle}</span></div>
                        </div>
                        <p>{post.caption}</p>
                        <div className="featured-actions">
                          <button
                            type="button"
                            onClick={() => toggleLike(post)}
                            aria-pressed={liked}
                            className={liked ? "liked" : ""}
                          >
                            <Heart size={15} fill={liked ? "currentColor" : "none"} />
                            {post.likes}
                          </button>
                          <span><MessageCircle size={15} /> {post.commentCount}</span>
                          <button type="button" onClick={() => sharePost(post.id)} aria-label="Share post">
                            <Share2 size={15} />
                            {copiedPost === post.id ? "Copied" : "Share"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {filteredPosts.length === 0 && (
                  <p className="explore-empty">No posts match this search yet.</p>
                )}
              </div>
              {shareError && <p className="share-error" role="alert">{shareError}</p>}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default Explore;
