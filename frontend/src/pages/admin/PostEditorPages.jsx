import { ArrowLeft, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PostForm from '../../components/admin/PostForm';
import Button from '../../components/ui/Button';
import { ErrorState, PageSpinner } from '../../components/ui/States';
import { invalidateCategories } from '../../hooks/useCategories';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useUtils';
import { aiApi } from '../../services/aiApi';
import { createPost, fetchPost, updatePost } from '../../services/postService';
import NotFoundPage from '../NotFoundPage';

/** If the post came from an AI draft, record what was actually published (best effort). */
function recordAiOutcome(meta, post) {
  if (!meta?.aiGenerationId || !post?.id) return;
  aiApi.outcome(meta.aiGenerationId, { postId: post.id, heading: post.heading, description: post.description }).catch(() => {});
}

function EditorHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Link to="/admin/posts" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All posts
        </Link>
        <h1 className="mt-2 font-display text-3xl font-black text-navy-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function CreatePostPage() {
  useDocumentTitle('Create post');
  const navigate = useNavigate();

  const onSubmit = async (payload, meta) => {
    try {
      const res = await createPost(payload);
      recordAiOutcome(meta, res.data);
      invalidateCategories();
      toast.success(res.message || 'Post published successfully.');
      navigate('/admin/posts');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  return (
    <>
      <EditorHeader title="Create a post" subtitle="Add an image, a heading and a description — then use the + buttons to build out the story." />
      <PostForm submitLabel={(published) => (published ? 'Publish post' : 'Save draft')} onSubmit={onSubmit} onCancel={() => navigate('/admin/posts')} />
    </>
  );
}

export function EditPostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: post, loading, error, reload } = useAsync((signal) => fetchPost(id, { signal }), [id]);
  useDocumentTitle(post ? `Edit: ${post.heading}` : 'Edit post');

  if (loading) return <PageSpinner label="Loading post…" />;
  if (error?.status === 404 || error?.status === 400) return <NotFoundPage title="Post not found" message="This post may have been deleted." />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const onSubmit = async (payload, meta) => {
    try {
      const res = await updatePost(post.id, payload);
      recordAiOutcome(meta, res.data);
      invalidateCategories();
      toast.success(res.message || 'Post updated successfully.');
      navigate('/admin/posts');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  return (
    <>
      <EditorHeader title="Edit post" subtitle={`Post #${post.id}`}>
        {post.published && (
          <Button to={`/news/${post.id}`} variant="secondary" size="sm" target="_blank" rel="noopener">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> View live
          </Button>
        )}
      </EditorHeader>
      <PostForm initialPost={post} submitLabel={(published) => (published ? 'Save & publish' : 'Save as draft')} onSubmit={onSubmit} onCancel={() => navigate('/admin/posts')} />
    </>
  );
}
