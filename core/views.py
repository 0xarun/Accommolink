from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import Post, Reply, UserProfile, Forum
from .forms import PostForm, ReplyForm, UserProfileForm, ForumForm
from django.template.loader import render_to_string
from django.core.paginator import Paginator
from django.db.models import Count, Prefetch
from django.shortcuts import redirect

def redirect_to_login(request):
    return redirect('/accounts/login/')

@login_required
def load_more_replies(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    offset = int(request.GET.get('offset', 0))
    limit = 2  # Load 5 replies at a time
    replies = (Reply.objects.filter(post=post, parent__isnull=True)
               .select_related('user__userprofile')
               .prefetch_related('children')
               .annotate(child_count=Count('children'))
               .order_by('created_at')[offset:offset+limit])
    
    total_replies = Reply.objects.filter(post=post, parent__isnull=True).count()
    has_more = total_replies > offset + limit

    replies_data = []
    for reply in replies:
        replies_data.append({
            'id': reply.id,
            'content': reply.content,
            'user_name': reply.user.username,
            'user_profile_picture': reply.user.userprofile.profile_picture.url if reply.user.userprofile.profile_picture else None,
            'post_id': post.id,
            'can_edit': request.user == reply.user,
            'child_count': reply.child_count,
            'created_at': reply.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return JsonResponse({
        'success': True,
        'replies': replies_data,
        'has_more': has_more
    })

@login_required
def forum_load_more_replies(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    offset = int(request.GET.get('offset', 0))
    limit = 5  # Increase the number of replies loaded at once

    replies = (Reply.objects.filter(post=post, parent__isnull=True)
               .select_related('user__userprofile')
               .prefetch_related('children')
               .annotate(child_count=Count('children'))
               .order_by('created_at')[offset:offset+limit])

    total_replies = Reply.objects.filter(post=post, parent__isnull=True).count()
    has_more = total_replies > offset + limit

    replies_data = []
    for reply in replies:
        replies_data.append({
            'id': reply.id,
            'content': reply.content,
            'user_name': reply.user.username,
            'user_profile_picture': reply.user.userprofile.profile_picture.url if reply.user.userprofile.profile_picture else None,
            'post_id': post.id,
            'can_edit': request.user == reply.user,
            'child_count': reply.child_count,
            'created_at': reply.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return JsonResponse({
        'success': True,
        'replies': replies_data,
        'has_more': has_more,
        'next_offset': offset + limit
    })

@login_required
def load_child_replies(request, reply_id):
    try:
        parent_reply = get_object_or_404(Reply, id=reply_id)
        child_replies = (Reply.objects.filter(parent=parent_reply)
                         .select_related('user__userprofile')
                         .annotate(child_count=Count('children'))
                         .order_by('created_at'))
        
        replies_data = []
        for reply in child_replies:
            replies_data.append({
                'id': reply.id,
                'content': reply.content,
                'user_name': reply.user.username,
                'user_profile_picture': reply.user.userprofile.profile_picture.url if reply.user.userprofile.profile_picture else None,
                'post_id': parent_reply.post_id,
                'can_edit': request.user == reply.user,
                'child_count': reply.child_count,
                'created_at': reply.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })

        return JsonResponse({
            'success': True,
            'replies': replies_data,
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@login_required
@require_POST
def create_forum_post(request, forum_slug):
    forum = get_object_or_404(Forum, slug=forum_slug)
    form = PostForm(request.POST, request.FILES)
    if form.is_valid():
        post = form.save(commit=False)
        post.user = request.user
        post.forum = forum
        post.save()
        return JsonResponse({'success': True, 'post_id': post.id})
    return JsonResponse({'success': False, 'errors': form.errors})

@login_required
def create_forum(request):
    if request.method == 'POST':
        form = ForumForm(request.POST)
        if form.is_valid():
            forum = form.save(commit=False)
            forum.created_by = request.user
            forum.save()
            return redirect('forum_detail', forum_slug=forum.slug)
    else:
        form = ForumForm()
    return render(request, 'create_forum.html', {'form': form})

def forum_list(request):
    forums = Forum.objects.annotate(post_count=Count('posts')).order_by('-created_at')
    return render(request, 'forum_list.html', {'forums': forums})

@login_required
def forum_detail(request, forum_slug):
    forum = get_object_or_404(Forum, slug=forum_slug)
    posts = forum.posts.all().order_by('-created_at')
    all_forums = Forum.objects.annotate(post_count=Count('posts')).all()


    
    posts = posts.prefetch_related(
        Prefetch('replies', 
                 queryset=Reply.objects.filter(parent__isnull=True)
                 .select_related('user__userprofile')
                 .annotate(child_count=Count('children'))
                 .order_by('created_at'),
                 to_attr='top_level_replies'
        )
    )
    
    paginator = Paginator(posts, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'forum': forum,
        'page_obj': page_obj,
        'all_forums': all_forums,
        'debug_forums': list(all_forums.values('title', 'slug')),  # Changed 'name' to 'title'

    }
    return render(request, 'forum_detail.html', context)

@login_required
def dashboard(request):
    posts = Post.objects.all().order_by('-created_at')
    user_profile, created = UserProfile.objects.get_or_create(user=request.user)
    
    forum_posts = Post.objects.filter(forum__isnull=False).order_by('-created_at')

    # Prefetch top-level replies for each post
    posts = posts.prefetch_related('replies')
    for post in posts:
        post.top_level_replies = post.replies.filter(parent__isnull=True)

    # Include forum posts in the same manner
    forum_posts = forum_posts.prefetch_related('replies')
    for post in forum_posts:
        post.top_level_replies = post.replies.filter(parent__isnull=True)
    
    context = {
        'posts': posts,
        'user': request.user,
        'user_profile': user_profile,
        'forum_posts': forum_posts,

    }
    return render(request, 'dashboard.html', context)

@login_required
def edit_profile(request):
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    if request.method == 'POST':
        form = UserProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True})
    return JsonResponse({'success': False})

@login_required
def create_post(request, forum_slug=None):
    forum = None
    if forum_slug:
        forum = get_object_or_404(Forum, slug=forum_slug)
    
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.user = request.user
            post.forum = forum  # Will be None if no forum_slug is provided
            post.save()
            return JsonResponse({'success': True})
    
    return JsonResponse({'success': False})

@login_required
@require_POST
def edit_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, user=request.user)
    form = PostForm(request.POST, request.FILES, instance=post)
    if form.is_valid():
        post = form.save()
        response_data = {'success': True}
        if post.image:
            response_data['image_url'] = post.image.url
        return JsonResponse(response_data)
    return JsonResponse({'success': False})

@login_required
@require_POST
def delete_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, user=request.user)
    post.delete()
    return JsonResponse({'success': True})

@login_required
@require_POST
def reply_to_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    parent_id = request.POST.get('parent_id')
    form = ReplyForm(request.POST)
    if form.is_valid():
        reply = form.save(commit=False)
        reply.user = request.user
        reply.post = post
        if parent_id:
            reply.parent = get_object_or_404(Reply, id=parent_id)
        reply.save()

        return JsonResponse({
            'success': True,
            'reply': {
                'id': reply.id,
                'content': reply.content,
                'user_name': reply.user.username,
                'user_profile_picture': reply.user.userprofile.profile_picture.url if reply.user.userprofile.profile_picture else None,
                'parent_user': reply.parent.user.username if reply.parent else None,
                'post_id': post.id,
                'can_edit': request.user == reply.user,
                'child_count': 0,
                'created_at': reply.created_at.strftime('%Y-%m-%d %H:%M:%S')  # Add this line

            }
        })
    return JsonResponse({'success': False})
    
@login_required
@require_POST
def edit_reply(request, reply_id):
    reply = get_object_or_404(Reply, id=reply_id, user=request.user)
    form = ReplyForm(request.POST, instance=reply)
    if form.is_valid():
        form.save()
        return JsonResponse({'success': True})
    return JsonResponse({'success': False})

@login_required
@require_POST
def delete_reply(request, reply_id):
    reply = get_object_or_404(Reply, id=reply_id, user=request.user)
    reply.delete()
    return JsonResponse({'success': True})