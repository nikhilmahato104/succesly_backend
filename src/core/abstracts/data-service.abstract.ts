import { IGenericRepository } from './generic-repository.abstract';
import { IModuleDocument }    from '../entities/module.entity';
import { IRoleDocument }      from '../entities/role.entity';
import { IUserDocument }      from '../entities/user.entity';
import { IApiKeyDocument }    from '../entities/api-key.entity';
import { IProjectDocument }        from '../entities/project.entity';
import { IActivityLogDocument }    from '../entities/activity-log.entity';
import { IDeviceInfoDocument }     from '../entities/device-info.entity';

export interface IDataServices {
  modules:  IGenericRepository<IModuleDocument>;
  roles:    IGenericRepository<IRoleDocument>;
  users:    IGenericRepository<IUserDocument>;
  apiKeys:  IGenericRepository<IApiKeyDocument>;
  projects:       IGenericRepository<IProjectDocument>;
  activityLogs:   IGenericRepository<IActivityLogDocument>;
  deviceInfos:    IGenericRepository<IDeviceInfoDocument>;
}
