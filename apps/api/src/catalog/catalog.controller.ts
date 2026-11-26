import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Type,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { cookieName, PublicRoute, Roles } from '../auth/guards';
import { CatalogService } from './catalog.service';
import {
  AdminServiceView,
  AdminStaffView,
  AssignmentsDto,
  CreateStaffDto,
  EditServiceDto,
  EditStaffDto,
  ServiceDto,
  ServiceQuery,
  ServiceView,
  StaffQuery,
  StaffView,
} from './catalog.dto';

function PageResponse(model: Type) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: getSchemaPath(model) } },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          hasNext: { type: 'boolean' },
        },
      },
    }),
  );
}
const WriteHeaders = () =>
  ApiHeader({
    name: 'X-BookingHub-CSRF',
    required: true,
    schema: { enum: ['1'] },
    description: 'Gửi cùng Origin của web.',
  });

@Controller('services')
@ApiTags('catalog')
@PublicRoute()
export class PublicCatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get()
  @PageResponse(ServiceView)
  list(@Query() query: ServiceQuery) {
    return this.catalog.services(query);
  }
  @Get(':id')
  @ApiOkResponse({ type: ServiceView })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.detail(id);
  }
  @Get(':id/staff')
  @PageResponse(StaffView)
  staff(@Param('id', ParseUUIDPipe) id: string, @Query() query: StaffQuery) {
    return this.catalog.staffForService(id, query);
  }
}

@Controller('admin')
@ApiTags('admin/catalog')
@Roles('ADMIN')
@ApiCookieAuth(cookieName)
@ApiResponse({ status: 401 })
@ApiResponse({ status: 403 })
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('services')
  @PageResponse(AdminServiceView)
  services(@Query() query: ServiceQuery) {
    return this.catalog.services(query, true);
  }
  @Post('services')
  @WriteHeaders()
  @ApiCreatedResponse({ type: AdminServiceView })
  createService(@Body() dto: ServiceDto) {
    return this.catalog.createService(dto);
  }
  @Patch('services/:id')
  @WriteHeaders()
  @ApiOkResponse({ type: AdminServiceView })
  editService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditServiceDto,
  ) {
    return this.catalog.updateService(id, dto);
  }
  @Get('staff')
  @PageResponse(AdminStaffView)
  staff(@Query() query: StaffQuery) {
    return this.catalog.staff(query);
  }
  @Post('staff')
  @WriteHeaders()
  @ApiCreatedResponse({ type: AdminStaffView })
  createStaff(@Body() dto: CreateStaffDto) {
    return this.catalog.createStaff(dto);
  }
  @Patch('staff/:id')
  @WriteHeaders()
  @ApiOkResponse({ type: AdminStaffView })
  editStaff(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EditStaffDto) {
    return this.catalog.updateStaff(id, dto);
  }
  @Put('staff/:id/services')
  @WriteHeaders()
  @ApiOkResponse({ type: AdminStaffView })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignmentsDto) {
    return this.catalog.setServices(id, dto.serviceIds);
  }
}
