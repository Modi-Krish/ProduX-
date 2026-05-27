import { useState } from 'react';
import { generateSubtasks } from '../api/aiApi';
import { toast } from 'react-hot-toast';

export const useAiWorkflow = (title, description, onSubtasksGenerated) => {
  const [isAiLoading, setIsAiLoading] = useState(false);

  const generate = async () => {
    if (!title.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await generateSubtasks(title, description);
      const generated = response.data.subtasks || [];
      if (generated.length > 0) {
        const formattedSubtasks = generated.map(subTitle => ({
          title: subTitle,
          isCompleted: false
        }));
        onSubtasksGenerated(formattedSubtasks);
        toast.success('✨ AI workflow subtasks generated!');
      } else {
        toast.error('AI failed to break down the task.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate AI subtasks.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return { isAiLoading, generate };
};
