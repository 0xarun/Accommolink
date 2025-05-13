from django import forms
from .models import Post, Reply, UserProfile, Forum

class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ['content', 'image']

class ReplyForm(forms.ModelForm):
    class Meta:
        model = Reply
        fields = ['content']

class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['bio', 'university', 'profile_picture']

class ForumForm(forms.ModelForm):
    class Meta:
        model = Forum
        fields = ['title', 'description', 'banner_image']
