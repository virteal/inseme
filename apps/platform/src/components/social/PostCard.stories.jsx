import PostCard from "./PostCard";
import { MemoryRouter } from "react-router-dom";

const samplePost = {
  id: "post-1",
  content: "# Mon titre\n\nCeci est **markdown** avec [un lien](https://example.com).",
  created_at: "2025-01-01T12:00:00Z",
  users: { id: "u1", display_name: "Jean" },
  metadata: { gazette: "global", groupId: "g1" },
};

export default {
  title: "Social/PostCard",
  component: PostCard,
  decorators: [(Story) => <MemoryRouter initialEntries={["/"]}>{Story()}</MemoryRouter>],
  argTypes: { showMarkdown: { control: "boolean" }, gazette: { control: "text" } },
};

const Template = (args) => <PostCard {...args} />;

export const Default = Template.bind({});
Default.args = { post: samplePost, currentUserId: "u1", showMarkdown: true, gazette: "global" };

export const Truncated = Template.bind({});
Truncated.args = {
  post: { ...samplePost, content: samplePost.content.repeat(40) },
  showMarkdown: true,
};
