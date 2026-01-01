import { useQuery, useMutation } from '@tanstack/react-query';
import { listAdminModels, testModels, TestRequest } from '@/lib/api/admin-models';

export const useAdminModels = () => {
  return useQuery({
    queryKey: ['admin-models'],
    queryFn: listAdminModels,
  });
};

export const useTestModels = () => {
  return useMutation({
    mutationFn: (request: TestRequest) => testModels(request),
  });
};
