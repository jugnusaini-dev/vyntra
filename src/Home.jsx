import Navbar from "./navpage/Navbar";
import "./Home.css";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const profilePhoto =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80";

function Home() {
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(profilePhoto);
  const [profile, setProfile] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [followedPeople, setFollowedPeople] = useState([]);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showFeelings, setShowFeelings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const imageInputRef = useRef(null);
  const profileInputRef = useRef(null);

  useEffect(() => {
    let isActive = true;
    Promise.all([api.getProfile(), api.getFollows()])
      .then(([profileResult, followResult]) => {
        if (!isActive) return;
        setProfile(profileResult.profile);
        setProfilePhotoUrl(profileResult.profile.avatar || profilePhoto);
        setFollowersCount(profileResult.stats.followers);
        setFollowingCount(profileResult.stats.following);
        setFollowedPeople(followResult.follows);
      })
      .catch((loadError) => {
        if (isActive) setError(loadError.message);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    api.getPosts(showFollowing)
      .then((result) => {
        if (isActive) setPosts(result.posts);
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
  }, [showFollowing]);

  const toggleLike = async (postId) => {
    const post = posts.find((item) => item.id === postId);
    if (!post) return;
    try {
      const result = await api.setPostLike(postId, !post.liked);
      setPosts((currentPosts) =>
        currentPosts.map((item) => item.id === postId ? result.post : item),
      );
    } catch (likeError) {
      setError(likeError.message);
    }
  };

  const handleImageChange = (event, setImage, isProfilePhoto = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        if (isProfilePhoto && profile) {
          api.updateProfile({ ...profile, avatar: reader.result })
            .then((result) => setProfile(result.profile))
            .catch((uploadError) => setError(uploadError.message));
        }
        setError("");
      } else {
        setError("The selected image could not be loaded.");
      }
    };
    reader.onerror = () => setError("The selected image could not be loaded.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const createPost = async () => {
    const content = postText.trim();
    if (!content && !postImage) {
      setError("Write something or add a photo before posting.");
      return;
    }

    try {
      const result = await api.createPost({ content, image: postImage });
      setPosts((currentPosts) => [result.post, ...currentPosts]);
      setPostText("");
      setPostImage("");
      setShowFeelings(false);
      setError("");
      setNotice("Your post has been shared.");
    } catch (postError) {
      setError(postError.message);
    }
  };

  const addComment = async (postId) => {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;

    try {
      const result = await api.addComment(postId, text);
      setPosts((currentPosts) =>
        currentPosts.map((post) => post.id === postId ? result.post : post),
      );
      setCommentDrafts((currentDrafts) => ({ ...currentDrafts, [postId]: "" }));
    } catch (commentError) {
      setError(commentError.message);
    }
  };

  const sharePost = async (postId) => {
    const url = `${window.location.origin}${window.location.pathname}#${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Vyntra post", url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("Post link copied to clipboard.");
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
      const result = await api.sharePost(postId);
      setPosts((currentPosts) =>
        currentPosts.map((post) => post.id === postId ? result.post : post),
      );
      setError("");
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setError(shareError.message || "The post could not be shared.");
      }
    }
  };

  const toggleFollow = async (personId, personName) => {
    const isFollowing = followedPeople.includes(personId);
    try {
      await api.setFollow(personId, !isFollowing);
      setFollowedPeople((currentPeople) =>
        isFollowing
          ? currentPeople.filter((id) => id !== personId)
          : [...currentPeople, personId],
      );
      setFollowingCount((count) => count + (isFollowing ? -1 : 1));
      setNotice(isFollowing ? `Unfollowed ${personName}.` : `Following ${personName}.`);
    } catch (followError) {
      setError(followError.message);
    }
  };

  const toggleCommentLike = async (postId, comment) => {
    try {
      await api.setCommentLike(comment.id, !comment.liked);
      setPosts((currentPosts) => currentPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((item) =>
                item.id === comment.id ? { ...item, liked: !comment.liked } : item,
              ),
            }
          : post,
      ));
    } catch (likeError) {
      setError(likeError.message);
    }
  };

  const visiblePosts = posts;

  return (
    <div className="home-page">
      <Navbar />

      <main className="home-layout">
        <aside className="home-sidebar profile-sidebar">
          <div className="profile-cover" />
          <button
            className="profile-photo-control"
            type="button"
            onClick={() => profileInputRef.current?.click()}
            aria-label="Change profile photo"
          >
            <img className="profile-photo" src={profilePhotoUrl} alt="Your profile" />
          </button>
          <input
            ref={profileInputRef}
            className="image-input"
            type="file"
            accept="image/*"
            onChange={(event) => handleImageChange(event, setProfilePhotoUrl, true)}
            aria-label="Choose a profile photo"
          />
          <h2>Welcome back, {profile?.name || "friend"}!</h2>
          <p className="profile-handle">{profile?.handle || "@you"}</p>
          <p className="profile-bio">
            Sharing little moments and big ideas. ✨
          </p>
          <div className="profile-stats">
            <div>
              <strong>{posts.filter((post) => post.userId === profile?.id).length}</strong>
              <span>Posts</span>
            </div>
            <div>
              <strong>{followersCount}</strong>
              <span>Followers</span>
            </div>
            <div>
              <strong>{followingCount}</strong>
              <span>Following</span>
            </div>
          </div>
          <a className="profile-link" href="/profile">
            View your profile <span aria-hidden="true">↗</span>
          </a>

          <div className="sidebar-note">
            <span className="sidebar-note-icon">✦</span>
            <div>
              <strong>Your space, your voice</strong>
              <p>Make today a little more connected.</p>
            </div>
          </div>
        </aside>

        <section className="feed-column" aria-label="Your social feed">
          <header className="feed-heading">
            <div>
              <span className="eyebrow">YOUR COMMUNITY</span>
              <h1>Home feed</h1>
            </div>
            <button
              className="feed-filter"
              type="button"
              onClick={() => setShowFollowing((current) => !current)}
              aria-label={showFollowing ? "Show For you feed" : "Show Following feed"}
            >
              {showFollowing ? "Following" : "✨ For you"} <span aria-hidden="true">⌄</span>
            </button>
          </header>

          <section className="stories-card" aria-label="Stories">
            <div className="stories-heading">
              <h2>Stories</h2>
              <span>See all</span>
            </div>
            <div className="stories-list">
              <div className="story-item">
                <div className="story-ring own-story">
                  <img src={profilePhotoUrl} alt="" />
                  <span className="story-add" aria-hidden="true">+</span>
                </div>
                <span>Your story</span>
              </div>
              <div className="story-item">
                <div className="story-ring">
                  <img
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80"
                    alt=""
                  />
                </div>
                <span>Alex</span>
              </div>
              <div className="story-item">
                <div className="story-ring">
                  <img
                    src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=100&h=100&q=80"
                    alt=""
                  />
                </div>
                <span>Maya</span>
              </div>
              <div className="story-item">
                <div className="story-ring">
                  <img
                    src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&h=100&q=80"
                    alt=""
                  />
                </div>
                <span>Daniel</span>
              </div>
              <div className="story-item">
                <div className="story-ring">
                  <img
                    src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=100&h=100&q=80"
                    alt=""
                  />
                </div>
                <span>Sophia</span>
              </div>
            </div>
          </section>

          <section className="create-post">
            <div className="composer-top">
              <img
                className="small-avatar"
                src={profilePhotoUrl}
                alt=""
              />
              <textarea
                aria-label="Write a post"
                placeholder="What's on your mind, Jugnu?"
                rows="2"
                value={postText}
                onChange={(event) => {
                  setPostText(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    createPost();
                  }
                }}
              />
            </div>
            {postImage && (
              <div className="composer-image-preview">
                <img src={postImage} alt="Selected post attachment" />
                <button
                  type="button"
                  onClick={() => setPostImage("")}
                  aria-label="Remove selected photo"
                >
                  ×
                </button>
              </div>
            )}
            <input
              ref={imageInputRef}
              className="image-input"
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange(event, setPostImage)}
              aria-label="Choose a photo to attach"
            />
            <div className="composer-bottom">
              <div className="composer-options">
                <button type="button" onClick={() => imageInputRef.current?.click()}>
                  <span className="option-photo">▧</span> Photo
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeelings((current) => !current)}
                  aria-expanded={showFeelings}
                >
                  <span className="option-mood">☺</span> Feeling
                </button>
              </div>
              <button className="post-submit" type="button" onClick={createPost}>
                Create post <span>↗</span>
              </button>
            </div>
            {showFeelings && (
              <div className="feeling-options" aria-label="Choose a feeling">
                {["😊 Happy", "🙏 Grateful", "✨ Inspired"].map((feeling) => (
                  <button
                    type="button"
                    key={feeling}
                    onClick={() => {
                      setPostText((currentText) =>
                        `${currentText.trimEnd()}${currentText.trim() ? " · " : ""}Feeling ${feeling}`,
                      );
                      setShowFeelings(false);
                    }}
                  >
                    {feeling}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="home-feedback error-feedback" role="alert">{error}</p>}
            {notice && <p className="home-feedback" role="status">{notice}</p>}
          </section>

          <div className="feed-posts">
            {isLoading && <p role="status">Loading posts...</p>}
            {visiblePosts.map((post) => (
            <article className="post-card" id={post.id} key={post.id}>
              <header className="post-header">
                <img
                  className="small-avatar"
                  src={post.avatar}
                  alt={post.name}
                />
                <div className="post-author">
                  <h2>{post.name} {post.id === "alex-morgan" && <span className="verified">✦</span>}</h2>
                  <p>{post.handle} <span>·</span> {post.time} <span>·</span> <span aria-label="Public">◎</span></p>
                </div>
                <button className="more-button" type="button" aria-label="More post options">•••</button>
              </header>
              {post.content && <p className="post-content">{post.content}</p>}
              {post.image && (
                <img className="post-image" src={post.image} alt={post.imageAlt} />
              )}
              <div className="post-counts">
                <span><span className="like-dot">♥</span> {post.likes} likes</span>
                <span>{post.commentCount} comments <span className="count-divider">·</span> {post.shares} shares</span>
              </div>
              <div className="post-actions">
                <button
                  type="button"
                  onClick={() => toggleLike(post.id)}
                  aria-pressed={post.liked}
                >
                  <span className="action-like">{post.liked ? "♥" : "♡"}</span>
                  {post.liked ? "Liked" : "Like"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCommentId((current) => current === post.id ? null : post.id)}
                  aria-expanded={activeCommentId === post.id}
                >
                  <span className="action-comment">▢</span> Comment
                </button>
                <button type="button" onClick={() => sharePost(post.id)}>
                  <span className="action-share">↗</span> Share
                </button>
              </div>
              {post.comments.map((comment) => (
                <div className="comment-preview" key={comment.id}>
                  <img className="comment-avatar" src={comment.avatar} alt="" />
                  <div className="comment-bubble">
                    <strong>{comment.name}</strong>
                    <span>{comment.text}</span>
                  </div>
                  <button
                    type="button"
                    className={`comment-like${comment.liked ? " is-liked" : ""}`}
                    aria-label={comment.liked ? "Unlike comment" : "Like comment"}
                    aria-pressed={Boolean(comment.liked)}
                    onClick={() => toggleCommentLike(post.id, comment)}
                  >
                    {comment.liked ? "♥" : "♡"}
                  </button>
                </div>
              ))}
              {activeCommentId === post.id && (
                <form
                  className="comment-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addComment(post.id);
                  }}
                >
                  <img className="comment-avatar" src={profilePhotoUrl} alt="" />
                  <input
                    type="text"
                    value={commentDrafts[post.id] || ""}
                    onChange={(event) => setCommentDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [post.id]: event.target.value,
                    }))}
                    placeholder="Write a comment..."
                    aria-label={`Write a comment on ${post.name}'s post`}
                  />
                  <button type="submit" disabled={!(commentDrafts[post.id] || "").trim()}>
                    Send
                  </button>
                </form>
              )}
              {post.commentCount > post.comments.length && (
                <button
                  className="view-comments"
                  type="button"
                  onClick={() => setActiveCommentId(post.id)}
                >
                  View all {post.commentCount} comments
                </button>
              )}
            </article>
            ))}
            {!isLoading && visiblePosts.length === 0 && (
              <div className="empty-feed">
                <strong>Your following feed is quiet for now.</strong>
                <span>Follow someone to see their posts here.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="home-sidebar discovery-sidebar">
          <section className="discover-card">
            <div className="sidebar-title">
              <h2>Trending today</h2>
              <span className="trending-spark">✦</span>
            </div>
            <a className="trend-item" href="/explore">
              <span className="trend-rank">01</span>
              <span><strong>#SundayReset</strong><small>2.4k posts</small></span>
              <span className="trend-arrow">↗</span>
            </a>
            <a className="trend-item" href="/explore">
              <span className="trend-rank">02</span>
              <span><strong>#LittleJoy</strong><small>1.8k posts</small></span>
              <span className="trend-arrow">↗</span>
            </a>
            <a className="trend-item" href="/explore">
              <span className="trend-rank">03</span>
              <span><strong>#CreativeMinds</strong><small>956 posts</small></span>
              <span className="trend-arrow">↗</span>
            </a>
            <a className="see-more" href="/explore">Explore more topics <span>→</span></a>
          </section>

          <section className="discover-card suggestions-card">
            <div className="sidebar-title">
              <h2>People to follow</h2>
              <span className="suggestions-spark">✦</span>
            </div>
            <div className="suggestion-item">
              <img
                src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&h=100&q=80"
                alt=""
              />
              <div><strong>Daniel Kim</strong><span>@danielcreates</span></div>
              <button
                type="button"
                onClick={() => toggleFollow("demo-daniel", "Daniel Kim")}
                aria-label={`${followedPeople.includes("demo-daniel") ? "Unfollow" : "Follow"} Daniel Kim`}
                aria-pressed={followedPeople.includes("demo-daniel")}
              >
                {followedPeople.includes("demo-daniel") ? "✓" : "+"}
              </button>
            </div>
            <div className="suggestion-item">
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=100&h=100&q=80"
                alt=""
              />
              <div><strong>Sophia Lee</strong><span>@sophialee</span></div>
              <button
                type="button"
                onClick={() => toggleFollow("demo-sophia", "Sophia Lee")}
                aria-label={`${followedPeople.includes("demo-sophia") ? "Unfollow" : "Follow"} Sophia Lee`}
                aria-pressed={followedPeople.includes("demo-sophia")}
              >
                {followedPeople.includes("demo-sophia") ? "✓" : "+"}
              </button>
            </div>
            <div className="suggestion-item">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80"
                alt=""
              />
              <div><strong>Ryan Brooks</strong><span>@ryanbrooks</span></div>
              <button
                type="button"
                onClick={() => toggleFollow("demo-ryan", "Ryan Brooks")}
                aria-label={`${followedPeople.includes("demo-ryan") ? "Unfollow" : "Follow"} Ryan Brooks`}
                aria-pressed={followedPeople.includes("demo-ryan")}
              >
                {followedPeople.includes("demo-ryan") ? "✓" : "+"}
              </button>
            </div>
            <a className="see-more" href="/explore">Find your people <span>→</span></a>
          </section>

          <footer className="home-footer">
            <div><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
            <span>© 2025 Vyntra · Your voice, your world.</span>
          </footer>
        </aside>
      </main>
    </div>
  );
}

export default Home;
