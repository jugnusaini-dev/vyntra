import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Camera,
  Check,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import Navbar from "./navpage/Navbar";
import { api } from "./api";
import "./Profile.css";

const startingProfile = {
  name: "Jugnu Saini",
  handle: "@jugnu.saini",
  bio: "Sharing little moments and big ideas. Making space for creativity, kind people, and a little more sunshine. ✨",
  location: "New Delhi, India",
  website: "vyntra.social/jugnu",
  avatar:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=80",
  cover:
    "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1600&q=85",
};

function Profile() {
  const [profile, setProfile] = useState(startingProfile);
  const [draftProfile, setDraftProfile] = useState(startingProfile);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [activeTab, setActiveTab] = useState("Posts");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [followDialog, setFollowDialog] = useState(null);
  const [followLists, setFollowLists] = useState({ followers: [], following: [] });
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);
  const [followListError, setFollowListError] = useState("");
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const openFollowList = async (list) => {
    setFollowDialog(list);
    setIsLoadingFollows(true);
    setFollowListError("");
    try {
      const result = await api.getFollowLists();
      setFollowLists(result);
    } catch (loadError) {
      setFollowListError(loadError.message);
    } finally {
      setIsLoadingFollows(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    api.getProfile()
      .then((result) => {
        if (!isActive) return;
        setProfile(result.profile);
        setDraftProfile(result.profile);
        setPosts(result.posts);
        setLikedPosts(result.likedPosts);
        setStats(result.stats);
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
  }, []);

  const uploadProfileImage = (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") {
        setError("The selected image could not be loaded.");
        return;
      }
      try {
        const result = await api.updateProfile({
          name: profile.name,
          username: profile.username,
          bio: profile.bio,
          location: profile.location,
          website: profile.website,
          avatar: field === "avatar" ? reader.result : profile.avatar,
          cover: field === "cover" ? reader.result : profile.cover,
        });
        setProfile(result.profile);
        setDraftProfile(result.profile);
        setError("");
        setFeedback(field === "avatar" ? "Profile photo updated." : "Cover photo updated.");
      } catch (uploadError) {
        setError(uploadError.message);
      }
    };
    reader.onerror = () => setError("The selected image could not be loaded.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const openEditor = () => {
    setDraftProfile(profile);
    setError("");
    setFeedback("");
    setIsEditing(true);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const name = draftProfile.name.trim();
    const handle = draftProfile.handle.trim().replace(/^@+/, "");
    if (!name || !handle) {
      setError("Name and username are required.");
      return;
    }
    try {
      const result = await api.updateProfile({
        name,
        username: handle,
        bio: draftProfile.bio.trim(),
        location: draftProfile.location.trim(),
        website: draftProfile.website.trim(),
        avatar: profile.avatar,
        cover: profile.cover,
      });
      setProfile(result.profile);
      setDraftProfile(result.profile);
      setIsEditing(false);
      setError("");
      setFeedback("Your profile has been updated.");
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const toggleLike = async (postId) => {
    const post = [...posts, ...likedPosts].find((item) => item.id === postId);
    if (!post) return;
    try {
      const result = await api.setPostLike(postId, !post.liked);
      setPosts((currentPosts) =>
        currentPosts.map((item) => item.id === postId ? result.post : item),
      );
      setLikedPosts((currentPosts) => result.post.liked
        ? currentPosts.some((item) => item.id === postId)
          ? currentPosts.map((item) => item.id === postId ? result.post : item)
          : [result.post, ...currentPosts]
        : currentPosts.filter((item) => item.id !== postId));
    } catch (likeError) {
      setError(likeError.message);
    }
  };

  const deletePost = async (postId) => {
    try {
      await api.deletePost(postId);
      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
      setLikedPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
      setStats((currentStats) => ({ ...currentStats, posts: Math.max(0, currentStats.posts - 1) }));
      setFeedback("Post deleted.");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/profile`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile.name} on Vyntra`, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback("Profile link copied.");
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
      setError("");
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setError(shareError.message || "The profile link could not be shared.");
      }
    }
  };

  const visiblePosts =
    activeTab === "Likes"
      ? likedPosts
      : activeTab === "Media"
        ? posts.filter((post) => post.image)
        : posts;

  const updateDraft = (field, value) => {
    setDraftProfile((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="profile-page">
      <Navbar />
      <main className="profile-layout">
        <section className="profile-main-card">
          <div className="profile-cover-wrap">
            <img className="profile-cover-image" src={profile.cover || startingProfile.cover} alt="" />
            <button
              type="button"
              className="cover-edit-button"
              onClick={() => coverInputRef.current?.click()}
            >
              <Camera size={15} /> Edit cover
            </button>
            <input
              ref={coverInputRef}
              className="profile-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => uploadProfileImage(event, "cover")}
              aria-label="Upload cover photo"
            />
          </div>

          <div className="profile-identity">
            <button
              type="button"
              className="profile-avatar-button"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Change profile photo"
            >
              <img src={profile.avatar || startingProfile.avatar} alt={`${profile.name} profile`} />
              <span><Camera size={15} /></span>
            </button>
            <input
              ref={avatarInputRef}
              className="profile-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => uploadProfileImage(event, "avatar")}
              aria-label="Upload profile photo"
            />
            <div className="profile-action-buttons">
              <button type="button" className="profile-share-button" onClick={shareProfile}>
                <Share2 size={15} /> Share profile
              </button>
              <button type="button" className="profile-edit-button" onClick={openEditor}>
                <Pencil size={15} /> Edit profile
              </button>
            </div>
          </div>

          <div className="profile-bio-section">
            <span className="profile-verified">VYNTRA MEMBER <span>✦</span></span>
            <h1>{profile.name}</h1>
            <p className="profile-user-handle">{profile.handle}</p>
            <p className="profile-description">{profile.bio}</p>
            <div className="profile-meta">
              {profile.location && <span><MapPin size={14} /> {profile.location}</span>}
              {profile.website && (
                <a href={`https://${profile.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={14} /> {profile.website}
                </a>
              )}
              <span>Joined October 2024</span>
            </div>
            <div className="profile-follow-stats">
              <span><strong>{stats.posts}</strong> posts</span>
              <button type="button" onClick={() => openFollowList("followers")}>
                <strong>{stats.followers}</strong> followers
              </button>
              <button type="button" onClick={() => openFollowList("following")}>
                <strong>{stats.following}</strong> following
              </button>
            </div>
          </div>

          <div className="profile-tabs" role="tablist" aria-label="Profile content">
            {["Posts", "Media", "Likes"].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === "Posts" && <span>{posts.length}</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="profile-posts-section" aria-label={`${activeTab} by ${profile.name}`}>
          <div className="profile-posts-heading">
            <div>
              <span className="profile-posts-kicker">YOUR CORNER OF VYNTRA</span>
              <h2>{activeTab}</h2>
            </div>
            <span className="profile-posts-count">{visiblePosts.length} shown</span>
          </div>

          {feedback && <p className="profile-feedback" role="status">{feedback}</p>}
          {error && <p className="profile-error" role="alert">{error}</p>}
          {isLoading && <p className="profile-feedback" role="status">Loading your profile...</p>}

          {visiblePosts.length ? (
            <div className="profile-post-grid">
              {visiblePosts.map((post) => (
                <article className="profile-post-card" key={post.id}>
                  {post.image && (
                    <div className="profile-post-image-wrap">
                      <img src={post.image} alt={post.imageAlt} />
                      <span>{post.time}</span>
                    </div>
                  )}
                  <div className="profile-post-body">
                    {!post.image && <span className="profile-post-date">{post.time}</span>}
                    <p>{post.content}</p>
                    <div className="profile-post-actions">
                      <button
                        type="button"
                        className={post.liked ? "liked" : ""}
                        onClick={() => toggleLike(post.id)}
                        aria-pressed={post.liked}
                      >
                        <Heart size={15} fill={post.liked ? "currentColor" : "none"} />
                        {post.likes}
                      </button>
                      <span><MessageCircle size={15} /> {post.commentCount}</span>
                      {post.userId === profile.id && <button
                        type="button"
                        className="delete-profile-post"
                        onClick={() => deletePost(post.id)}
                        aria-label="Delete post"
                        title="Delete post"
                      >
                        <Trash2 size={15} />
                      </button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="profile-posts-empty">
              <div><ImageIcon size={24} /></div>
              <strong>{activeTab === "Likes" ? "No liked posts yet" : "No photos yet"}</strong>
              <p>
                {activeTab === "Likes"
                  ? "Posts you like will show up here."
                  : "Posts with photos will appear here."}
              </p>
            </div>
          )}
        </section>
      </main>

      {followDialog && (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFollowDialog(null);
          }}
        >
          <section
            className="follow-list-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-list-title"
          >
            <header>
              <h2 id="follow-list-title">
                {followDialog === "followers" ? "Followers" : "Following"}
              </h2>
              <button
                type="button"
                onClick={() => setFollowDialog(null)}
                aria-label="Close follow list"
              >
                <X size={19} />
              </button>
            </header>
            {isLoadingFollows && <p role="status">Loading people...</p>}
            {followListError && <p className="profile-error" role="alert">{followListError}</p>}
            {!isLoadingFollows && !followListError && (
              <div className="follow-list">
                {followLists[followDialog].map((person) => (
                  <article key={person.id} className="follow-list-person">
                    <img src={person.avatar || startingProfile.avatar} alt="" />
                    <div>
                      <strong>{person.name}</strong>
                      <span>{person.handle}</span>
                      {person.bio && <p>{person.bio}</p>}
                    </div>
                  </article>
                ))}
                {followLists[followDialog].length === 0 && (
                  <p className="follow-list-empty">
                    {followDialog === "followers"
                      ? "No one follows you yet."
                      : "You are not following anyone yet."}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {isEditing && (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsEditing(false);
          }}
        >
          <form className="profile-edit-modal" onSubmit={saveProfile}>
            <header>
              <div>
                <span className="profile-posts-kicker">MAKE IT YOURS</span>
                <h2>Edit profile</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                aria-label="Close edit profile"
              >
                <X size={19} />
              </button>
            </header>
            <label>
              Name
              <input
                value={draftProfile.name}
                maxLength={50}
                onChange={(event) => updateDraft("name", event.target.value)}
              />
            </label>
            <label>
              Username
              <input
                value={draftProfile.handle.replace(/^@/, "")}
                maxLength={30}
                onChange={(event) => updateDraft("handle", `@${event.target.value.replace(/^@+/, "")}`)}
              />
            </label>
            <label>
              Bio
              <textarea
                value={draftProfile.bio}
                maxLength={180}
                rows="3"
                onChange={(event) => updateDraft("bio", event.target.value)}
              />
              <span className="profile-character-count">{draftProfile.bio.length}/180</span>
            </label>
            <label>
              Location
              <input
                value={draftProfile.location}
                maxLength={60}
                onChange={(event) => updateDraft("location", event.target.value)}
              />
            </label>
            <label>
              Website
              <input
                value={draftProfile.website}
                maxLength={100}
                onChange={(event) => updateDraft("website", event.target.value)}
              />
            </label>
            {error && <p className="profile-error" role="alert">{error}</p>}
            <footer>
              <button type="button" className="profile-cancel-button" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="profile-save-button">
                <Check size={15} /> Save changes
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

export default Profile;
