import { Router } from 'express';
import { listCapitalProjects, getCapitalProject, createCapitalProject, updateCapitalProject, deleteCapitalProject } from '../controllers/capitalProjectController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', listCapitalProjects);
router.get('/:id', getCapitalProject);
router.post('/', createCapitalProject);
router.put('/:id', updateCapitalProject);
router.delete('/:id', deleteCapitalProject);

export default router;
