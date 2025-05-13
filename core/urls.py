from django.urls import path
from . import views

urlpatterns = [
    path('', views.redirect_to_login, name='root_redirect'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('edit_profile/', views.edit_profile, name='edit_profile'),
    path('create_post/', views.create_post, name='create_post'),
    path('edit_post/<int:post_id>/', views.edit_post, name='edit_post'),
    path('delete_post/<int:post_id>/', views.delete_post, name='delete_post'),
    path('reply_to_post/<int:post_id>/', views.reply_to_post, name='reply_to_post'),
    path('edit_reply/<int:reply_id>/', views.edit_reply, name='edit_reply'),
    path('delete_reply/<int:reply_id>/', views.delete_reply, name='delete_reply'),
    path('forum/create/', views.create_forum, name='create_forum'),
    path('forums/', views.forum_list, name='forum_list'),
    path('forum/<slug:forum_slug>/', views.forum_detail, name='forum_detail'),
    path('forum/<slug:forum_slug>/create_post/', views.create_post, name='create_post'),
    path('load_more_replies/<int:post_id>/', views.load_more_replies, name='load_more_replies'),
    path('load_child_replies/<int:reply_id>/', views.load_child_replies, name='load_child_replies'),
    path('forum_load_more_replies/<int:post_id>/', views.forum_load_more_replies, name='forum_load_more_replies'),


]