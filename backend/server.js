require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const connectDB = require('./config/database');
const Message = require('./models/Message');
const User = require('./models/User');
const Post = require('./models/Post');
const FriendRequest = require('./models/FriendRequest');
const Notification = require('./models/Notification');
const Story = require('./models/Story');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*", // In production, specify your React Native app URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

connectDB();

let latestPostsCache = null;


const createNotification = async (recipient, sender, type, post = null, message = '') => {
  try {
    if (recipient.toString() === sender.toString()) return; // Don't notify self
    
    const notification = new Notification({
      recipient,
      sender,
      type,
      post,
      message
    });
    await notification.save();
    
    const senderUser = await User.findById(sender).select('name avatar');
    io.to(recipient.toString()).emit('newNotification', {
      _id: notification._id,
      type,
      fromUser: senderUser,
      message,
      createdAt: notification.createdAt,
      post
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

app.get('/api/cloudinary/signature', (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp },
      process.env.CLOUDINARY_API_SECRET
    );
    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY
    });
  } catch (error) {
    console.error('Cloudinary Signature Error:', error);
    res.status(500).json({ error: 'Failed to generate signature' });
  }
});



app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ error: 'Please provide name, email, mobile, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = new User({
      name,
      email,
      mobile,
      password,
    });

    await user.save();

    const userResponse = user.toJSON();

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userResponse = user.toJSON();

    res.json({
      message: 'Login successful',
      user: userResponse,
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/auth/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/auth/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { avatar, bio } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (avatar !== undefined) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/profile/full/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { currentUserId } = req.query;
    if (currentUserId === 'undefined' || currentUserId === 'null') currentUserId = null;
    
    const [user, posts, friendships, targetStatus] = await Promise.all([
      User.findById(id).select('-password').lean(),
      Post.find({ "user._id": id }).sort({ createdAt: -1 }).lean(),
      FriendRequest.find({
        $or: [{ fromUser: id }, { toUser: id }],
        status: 'accepted'
      }).populate('fromUser toUser', 'name avatar').lean(),
      currentUserId ? FriendRequest.findOne({
        $or: [
          { fromUser: currentUserId, toUser: id },
          { fromUser: id, toUser: currentUserId }
        ]
      }).lean() : null
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const uniqueFriendsMap = new Map();
    friendships.forEach(f => {
      if (!f.fromUser || !f.toUser) return;
      const friend = f.fromUser._id.toString() === id ? f.toUser : f.fromUser;
      if (friend && !uniqueFriendsMap.has(friend._id.toString())) {
        uniqueFriendsMap.set(friend._id.toString(), friend);
      }
    });
    const friendsList = Array.from(uniqueFriendsMap.values());

    const totalLikes = posts.reduce((sum, post) => sum + (post.likesCount || 0), 0);

    const formatCount = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    };

    res.json({
      user,
      posts,
      friends: friendsList,
      stats: {
        postsCount: posts.length,
        friendsCount: friendsList.length,
        likesCount: formatCount(totalLikes),
        rawLikes: totalLikes
      },
      friendStatus: targetStatus ? (targetStatus.status === 'accepted' ? 'friends' : (targetStatus.fromUser.toString() === currentUserId ? 'requested' : 'pending')) : 'none'
    });

  } catch (error) {
    console.error('Error fetching full profile:', error);
    res.status(500).json({ error: 'Failed to fetch full profile' });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) return res.json([]);
    
    const users = await User.find({
      name: { $regex: q.trim(), $options: 'i' }
    }).select('name avatar bio').limit(10).lean();
    
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

app.get('/api/users/all', async (req, res) => {
  try {
    const users = await User.find().select('name avatar').lean();
    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});


app.get('/api/friends/status/:userId', async (req, res) => {
  try {
    let fromUserId = req.query.currentUserId;
    if (fromUserId === 'undefined' || fromUserId === 'null') fromUserId = null;
    if (!fromUserId) return res.status(400).json({ error: 'currentUserId required' });
    const toUserId = req.params.userId;

    const request = await FriendRequest.findOne({
      $or: [
        { fromUser: fromUserId, toUser: toUserId },
        { fromUser: toUserId, toUser: fromUserId }
      ]
    });

    if (!request) {
      return res.json({ status: 'none' });
    }

    if (request.status === 'accepted') {
      return res.json({ status: 'friends' });
    }

    if (request.fromUser.toString() === fromUserId) {
      return res.json({ status: 'requested' });
    }

    res.json({ status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/request', async (req, res) => {
  try {
    const { toUserId, fromUserId } = req.body;
    if (!fromUserId || !toUserId) return res.status(400).json({ error: 'IDs required' });

    const existingRequest = await FriendRequest.findOne({
      fromUser: fromUserId,
      toUser: toUserId
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Request already sent' });
    }

    const newRequest = new FriendRequest({
      fromUser: fromUserId,
      toUser: toUserId
    });

    await newRequest.save();
    
    io.emit('new_friend_request', { 
      toUserId, 
      fromUserId 
    });

    createNotification(toUserId, fromUserId, 'FRIEND_REQUEST', null, 'sent you a friend request!');

    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/friends/requests', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const requests = await FriendRequest.find({
      toUser: userId,
      status: 'pending'
    }).populate('fromUser', 'name avatar').lean();
    
    const validRequests = requests.filter(r => r.fromUser !== null);
    
    res.json(validRequests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/accept', async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await FriendRequest.findById(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    request.status = 'accepted';
    await request.save();
    
    createNotification(request.fromUser, request.toUser, 'FRIEND_ACCEPT', null, 'accepted your friend request!');

    res.json({ message: 'Request accepted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/cancel', async (req, res) => {
  try {
    const { toUserId, fromUserId } = req.body;
    await FriendRequest.findOneAndDelete({
      $or: [
        { fromUser: fromUserId, toUser: toUserId },
        { fromUser: toUserId, toUser: fromUserId }
      ]
    });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/friends/list/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const friendships = await FriendRequest.find({
      $or: [{ fromUser: userId }, { toUser: userId }],
      status: 'accepted'
    }).populate('fromUser toUser', 'name avatar').lean();
    
    const uniqueFriendsMap = new Map();
    friendships.forEach(f => {
      if (!f.fromUser || !f.toUser) return;
      const friend = f.fromUser._id.toString() === userId ? f.toUser : f.fromUser;
      if (friend && !uniqueFriendsMap.has(friend._id.toString())) {
        uniqueFriendsMap.set(friend._id.toString(), friend);
      }
    });
    
    res.json(Array.from(uniqueFriendsMap.values()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .populate('sender', 'name avatar')
      .limit(50)
      .lean();

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/read', async (req, res) => {
  try {
    const { userId } = req.body;
    await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true } });
    res.json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});


app.post('/api/posts', async (req, res) => {
  try {
    latestPostsCache = null; // Invalidate cache

    const { userId, userName, userAvatar, text, header, subHeader, body, images } = req.body;

    if (!userId || !userName) {
      return res.status(400).json({ error: 'User info is required' });
    }

    if (!text && !header && !body && (!images || images.length === 0)) {
       return res.status(400).json({ error: 'Post must contain some text or images' });
    }

    const post = new Post({
      user: {
        _id: userId,
        name: userName,
        avatar: userAvatar || '',
      },
      text: text || '',
      header: header || '',
      subHeader: subHeader || '',
      body: body || '',
      images: images || [],
    });

    await post.save();
    
    const populatedPost = await Post.findById(post._id).lean();
    
    io.emit('new_post', populatedPost);

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: error.message || 'Failed to create post' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const { userId, since } = req.query;
    let query = {};
    console.log('HIT /api/posts query:', query);
    
    if (since && since !== 'undefined') {
      query.createdAt = { $gt: new Date(parseInt(since)) };
    }

    let posts;
    const isInitialFeed = !since || since === 'undefined';

    if (isInitialFeed && latestPostsCache) {
      console.log('Serving posts from in-memory cache');
      posts = latestPostsCache;
    } else {
      console.log('Fetching posts from DB');
      posts = await Post.find(query).sort({ createdAt: -1 }).limit(20).lean();
      
      if (isInitialFeed) {
        latestPostsCache = posts;
      }
    }
    
    const postsWithLikeStatus = posts.map(post => {
      const isLiked = (userId && post.likes) 
        ? post.likes.some(likeId => likeId.toString() === userId.toString()) 
        : false;
      return {
        ...post,
        isLiked,
        likesCount: post.likes ? post.likes.length : 0 // Always derive from source of truth
      };
    });
    
    res.json(postsWithLikeStatus);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts/sync-likes', async (req, res) => {
  try {
    const posts = await Post.find();
    let fixed = 0;
    for (const post of posts) {
      const correctCount = post.likes.length;
      if (post.likesCount !== correctCount) {
        post.likesCount = correctCount;
        await post.save();
        fixed++;
      }
    }
    res.json({ message: `Synced ${fixed} posts`, total: posts.length, fixed });
  } catch (error) {
    console.error('Error syncing likes:', error);
    res.status(500).json({ error: 'Failed to sync likes' });
  }
});

app.get('/api/posts/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const posts = await Post.find({ "user._id": userId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    latestPostsCache = null; // Invalidate cache

    const { id } = req.params;
    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await Post.findByIdAndDelete(id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

app.post('/api/posts/:id/like', async (req, res) => {
  try {
    latestPostsCache = null; // Invalidate cache

    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const mongoose = require('mongoose');
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (castErr) {
      return res.status(400).json({ error: 'Invalid User ID format' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const wasLiked = post.likes.some(likeId => likeId.toString() === userId.toString());
    let updatedPost;

    if (!wasLiked) {
      updatedPost = await Post.findOneAndUpdate(
        { _id: id, likes: { $ne: userObjectId } },
        { $addToSet: { likes: userObjectId } },
        { new: true }
      );
      
      if (!updatedPost) {
        updatedPost = await Post.findById(id);
      } else {
        updatedPost.likesCount = updatedPost.likes.length;
        await updatedPost.save();
        
        createNotification(post.user._id, userId, 'LIKE', post._id, 'liked your post');
      }
    } else {
      updatedPost = await Post.findOneAndUpdate(
        { _id: id, likes: userObjectId },
        { $pull: { likes: userObjectId } },
        { new: true }
      );
      
      if (!updatedPost) {
        updatedPost = await Post.findById(id);
      } else {
        updatedPost.likesCount = updatedPost.likes.length;
        await updatedPost.save();
      }
    }

    const finalLikesCount = updatedPost.likes.length;
    const finalIsLiked = updatedPost.likes.some(likeId => likeId.toString() === userId.toString());

    io.emit('postLikeUpdate', {
      postId: id,
      likesCount: finalLikesCount,
      userId: userId,
      isLiked: finalIsLiked
    });

    res.json({ 
      likesCount: finalLikesCount, 
      isLiked: finalIsLiked
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    latestPostsCache = null; // Invalidate cache

    const { id } = req.params;
    const { user, avatar, text, parentId } = req.body;

    if (!user || !text) {
      return res.status(400).json({ error: 'Username and comment text are required' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const newComment = {
      user,
      avatar: avatar || '',
      text,
      time: new Date(),
      parentId: parentId || null
    };

    post.comments.push(newComment);
    await post.save();

    const sender = await User.findOne({ name: user });
    if (sender) {
      createNotification(post.user._id, sender._id, 'COMMENT', post._id, `commented: ${text}`);
    }

    const savedComment = post.comments[post.comments.length - 1];

    io.emit('postCommentUpdate', {
      postId: id,
      comment: savedComment
    });

    res.status(201).json(savedComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});



app.post('/api/stories', async (req, res) => {
  try {
    const { userId, content, type } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'User ID and content are required' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const storiesCount = await Story.countDocuments({
      user: userId,
      createdAt: { $gte: startOfDay }
    });

    if (storiesCount >= 10) {
      return res.status(400).json({ error: 'You have reached the daily limit of 10 stories' });
    }

    const story = new Story({
      user: userId,
      content,
      type: type || 'image'
    });

    await story.save();
    
    const populatedStory = await Story.findById(story._id).populate('user', 'name avatar').lean();
    
    io.emit('new_story', populatedStory);

    res.status(201).json(populatedStory);
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

app.get('/api/stories', async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stories = await Story.find({
      createdAt: { $gte: twentyFourHoursAgo }
    })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .lean();

    const groupedStories = stories.reduce((acc, story) => {
      const userId = story.user._id.toString();
      if (!acc[userId]) {
        acc[userId] = {
          user: story.user,
          stories: []
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    res.json(Object.values(groupedStories));
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

app.delete('/api/stories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // To verify ownership

    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    if (story.user.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Story.findByIdAndDelete(id);
    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

app.post('/api/stories/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const isLiked = story.likes.includes(userId);
    if (isLiked) {
      story.likes = story.likes.filter(id => id.toString() !== userId);
    } else {
      story.likes.push(userId);
      if (story.user.toString() !== userId) {
        createNotification(story.user, userId, 'LIKE', null, 'liked your story');
      }
    }

    await story.save();
    res.json({ likes: story.likes, isLiked: !isLiked });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like story' });
  }
});

app.post('/api/stories/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const alreadyViewed = story.views.some(v => v.user.toString() === userId);
    if (story.user.toString() !== userId && !alreadyViewed) {
      story.views.push({ user: userId });
      await story.save();
    }

    res.json({ viewsCount: story.views.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark story as viewed' });
  }
});

app.get('/api/stories/:id/viewers', async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id)
      .populate('views.user', 'name avatar')
      .populate('likes', 'name avatar')
      .lean();

    if (!story) return res.status(404).json({ error: 'Story not found' });

    res.json({
      viewCount: story.views.length,
      viewers: story.views.map(v => ({
        user: v.user,
        seenAt: v.seenAt
      })).reverse(), // Show newest viewers first
      likers: story.likes || []
    });
  } catch (error) {
    console.error('Error fetching viewers/likers:', error);
    res.status(500).json({ error: 'Failed to fetch viewers' });
  }
});


app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId })
      .sort({ timestamp: -1 }) // Sort by timestamp descending (newest first)
      .limit(100) // Limit to last 100 messages
      .lean(); // Faster query execution

    messages.reverse();

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

async function getChatListForUser(userId) {
  if (!userId || userId === 'undefined' || userId === 'null') {
    return [];
  }
  
  const messages = await Message.find({ chatId: { $regex: userId } })
    .sort({ timestamp: -1 })
    .lean();

  const chatMap = new Map();
  messages.forEach(msg => {
    if (!chatMap.has(msg.chatId)) {
      chatMap.set(msg.chatId, msg);
    }
  });

  const chats = [];
  for (const [chatId, latestMsg] of chatMap.entries()) {
    const ids = chatId.split('_');
    if (ids.length !== 2) continue;
    
    const friendId = ids[0] === userId ? ids[1] : ids[0];
    const friend = await User.findById(friendId).select('name avatar').lean();
    
    if (friend) {
      const msgDate = new Date(latestMsg.timestamp);
      const now = new Date();
      const diffMs = now.getTime() - msgDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      let timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diffMins < 1) timeStr = 'Just now';
      else if (diffMins < 60) timeStr = `${diffMins}m ago`;
      else if (diffHours < 24) timeStr = `${diffHours}h ago`;
      else if (diffDays === 1) timeStr = 'Yesterday';

      const unreadCount = messages.filter(
        m => m.chatId === latestMsg.chatId && m.senderId === friendId && m.status !== 'read'
      ).length;

      chats.push({
        id: friend._id.toString(),
        name: friend.name,
        avatar: friend.avatar || 'https://via.placeholder.com/150',
        message: latestMsg.text,
        time: timeStr,
        timestamp: latestMsg.timestamp,
        unread: unreadCount,
        online: true
      });
    }
  }

  chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return chats;
}

app.get('/api/chats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const chats = await getChatListForUser(userId);
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).json({ error: 'Failed to fetch chat list' });
  }
});

app.delete('/api/messages/chat/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    await Message.deleteMany({ chatId });
    
    io.to(chatId).emit('chatCleared', { chatId });
    
    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    console.error('Error clearing chat:', error);
    res.status(500).json({ error: 'Failed to clear chat' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { chatId, senderId, senderName, text } = req.body;

    if (!chatId || !senderId || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const message = new Message({
      chatId,
      senderId,
      senderName: senderName || 'Unknown',
      text,
      timestamp: new Date(),
    });

    await message.save();

    io.to(chatId).emit('newMessage', message);

    res.json(message);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat: ${chatId}`);
  });

  socket.on('leaveChat', (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat: ${chatId}`);
  });

  socket.on('joinUser', (userId) => {
    socket.join(userId);
    console.log(`User ${socket.id} joined personal room: ${userId}`);
  });

  socket.on('sendMessage', async (data) => {
    try {
      const { chatId, senderId, senderName, text, recipientId } = data;

      if (!chatId || !senderId || !text) {
        return socket.emit('error', { message: 'Missing required fields' });
      }

      const message = new Message({
        chatId,
        senderId,
        senderName: senderName || 'Unknown',
        text,
        timestamp: new Date(),
      });

      await message.save();

      io.to(chatId).emit('newMessage', message);

      const senderChats = await getChatListForUser(senderId);
      io.to(senderId).emit('chatListUpdate', senderChats);

      if (recipientId) {
        createNotification(recipientId, senderId, 'MESSAGE', null, text);
        
        const recipientChats = await getChatListForUser(recipientId);
        io.to(recipientId).emit('chatListUpdate', recipientChats);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', (data) => {
    const { chatId, senderName, isTyping } = data;
    socket.to(chatId).emit('userTyping', { senderName, isTyping });
  });

  socket.on('markMessagesRead', async (data) => {
    try {
      const { chatId, readerId } = data;
      const result = await Message.updateMany(
        { chatId, senderId: { $ne: readerId }, status: { $ne: 'read' } },
        { $set: { status: 'read' } }
      );
      
      const updatedChats = await getChatListForUser(readerId);
      io.to(readerId).emit('chatListUpdate', updatedChats);

      if (result.modifiedCount > 0) {
        io.to(chatId).emit('messagesRead', { chatId, readerId });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  socket.on('requestChatList', async (userId) => {
    try {
      const chats = await getChatListForUser(userId);
      socket.emit('chatListUpdate', chats);
    } catch (error) {
      console.error('Error fetching chat list via socket:', error);
    }
  });

  socket.on('requestMessages', async (data) => {
    try {
      const { chatId, skip = 0, limit = 20 } = typeof data === 'string' ? { chatId: data } : data;
      
      const messages = await Message.find({ chatId })
        .sort({ timestamp: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .lean();
        
      socket.emit('chatHistory', { 
        chatId, 
        messages, 
        hasMore: messages.length === limit,
        skip: skip 
      });
    } catch (error) {
      console.error('Error fetching messages via socket:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const localIp = Object.values(networkInterfaces)
    .flat()
    .find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
    
  console.log(`🚀 Server running on http://${localIp}:${PORT}`);
  console.log(`📡 Socket.io server ready for connections`);
});
